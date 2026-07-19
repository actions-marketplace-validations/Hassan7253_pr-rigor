# Start here

## Fastest safe publication path

```bash
unzip pr-rigor-v1.zip
cd pr-rigor-v1

npm run customize -- \
  --owner YOUR_GITHUB_USERNAME \
  --name "YOUR DISPLAY NAME" \
  --npm-scope YOUR_NPM_USERNAME

npm install
npm run check

git init
git add .
git commit -m "Initial release of PR Rigor"
git branch -M main

gh repo create pr-rigor \
  --public \
  --description "Deterministic pull-request readiness and supply-chain checks for maintainers" \
  --source . \
  --remote origin \
  --push
```

Then:

1. Wait for `CI` and `CodeQL` to turn green.
2. Follow [docs/UPLOAD.md](docs/UPLOAD.md) to protect `main`, open the dogfood pull request, create `v1.0.0` and `v1`, and publish the Action to GitHub Marketplace.
3. Install it on a second repository you genuinely maintain and open one real pull request.
4. Use [docs/APPLICATIONS.md](docs/APPLICATIONS.md) to prepare both applications with actual links and numbers.

The GitHub Action is the primary product. npm publication is optional.
