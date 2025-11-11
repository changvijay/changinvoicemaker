# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/6aa3ab7e-03bf-4c36-9d73-7d4bd5b92987

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/6aa3ab7e-03bf-4c36-9d73-7d4bd5b92987) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Local JSON Invoice API

The app can persist invoices to a local JSON file via a lightweight Express server.

1. Install the dependencies: `npm install` (or `bun install`).
2. In one terminal, start the invoice API: `npm run server`. This launches `server/invoiceServer.mjs` on `http://localhost:4000` and writes data to `data/invoices.json`.
3. Create a `.env` (or `.env.local`) in the project root with `VITE_INVOICE_API_URL=http://localhost:4000/api/invoices`.
4. In another terminal, start the UI: `npm run dev` (or `bun run dev`).

If the API is unreachable (or the env var is omitted), the UI automatically falls back to browser `localStorage`, so you still have basic persistence.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/6aa3ab7e-03bf-4c36-9d73-7d4bd5b92987) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
