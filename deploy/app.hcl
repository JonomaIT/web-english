runtime    = "cloudfront"
name       = "web-english"
source_dir = "dist" # what `npm run build` writes
spa        = true   # client-side routes (/lessons/<slug>): the app's paths serve index.html

# Progress sync between devices: a Lambda at /api/* (api/). The site is public; the API asks for the
# sign-in it keeps in SSM (<SECRETS_PATH>/login, set with `npm run set-login`).
api = {
  source_dir = "api"
  handler    = "index.handler"
}
