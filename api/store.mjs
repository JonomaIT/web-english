// The progress table (deploy/data.hcl: progress, key user + card), through the low-level DynamoDB
// client the Lambda runtime already ships. One item per card the person studied, holding its FSRS
// state as JSON; one item per answer ("log#<when>#<card>"), kept for tuning FSRS later.
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

const CARD = "card#";
const LOG = "log#";

export function createStore({ table, client = new DynamoDBClient({}) }) {
  return {
    /** Every card of this person: { [cardId]: { card, firstReviewAt } }. */
    async load(user) {
      const cards = {};
      let start;
      do {
        const page = await client.send(
          new QueryCommand({
            TableName: table,
            KeyConditionExpression: "#u = :u AND begins_with(#c, :p)",
            ExpressionAttributeNames: { "#u": "user", "#c": "card" },
            ExpressionAttributeValues: { ":u": { S: user }, ":p": { S: CARD } },
            ExclusiveStartKey: start,
          }),
        );
        for (const item of page.Items ?? []) cards[item.card.S.slice(CARD.length)] = JSON.parse(item.data.S);
        start = page.LastEvaluatedKey;
      } while (start);
      return cards;
    },

    /**
     * Saves a card unless the table already has a later review of it (another device answered it
     * after this one): the latest review wins. Returns false when the stored one was newer.
     */
    async save(user, cardId, progress, review) {
      const reviewedAt = progress.card.lastReviewAt ?? "";
      try {
        await client.send(
          new PutItemCommand({
            TableName: table,
            Item: {
              user: { S: user },
              card: { S: CARD + cardId },
              data: { S: JSON.stringify(progress) },
              reviewedAt: { S: reviewedAt },
            },
            ConditionExpression: "attribute_not_exists(#r) OR #r <= :r",
            ExpressionAttributeNames: { "#r": "reviewedAt" },
            ExpressionAttributeValues: { ":r": { S: reviewedAt } },
          }),
        );
      } catch (err) {
        if (err?.name === "ConditionalCheckFailedException") return false;
        throw err;
      }
      if (review) {
        await client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              [table]: [
                {
                  PutRequest: {
                    Item: {
                      user: { S: user },
                      card: { S: `${LOG}${review.at}#${cardId}` },
                      data: { S: JSON.stringify(review) },
                    },
                  },
                },
              ],
            },
          }),
        );
      }
      return true;
    },
  };
}
