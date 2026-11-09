# The progress of each person: one item per card studied (its FSRS state) and one per answer.
# The API gets the table's name as TABLE_PROGRESS.
tables = {
  progress = { hash_key = "user", range_key = "card" }
}
