# Product overview

Describe your website here in a few paragraphs: what it is, who it is for,
and what people can do with it. Everything in this `spec/` folder is plain
language. Write it the way you would explain the product to a new teammate.

When you change any file here and run `bb compile`, BlackBox works out what
changed and updates the website to match.

## Folders

- `domain/`: the things your product deals with (users, orders, books...) and the rules about them.
- `frontend/pages/`: one file per page: what it shows and what you can do on it.
- `frontend/components/`: pieces that appear on many pages (header, footer, menus).
- `backend/`: behaviour that isn't a page: emails, payments, scheduled jobs, integrations.
- `database/`: only if you have requirements about data (retention, imports, existing databases).
- `design/`: look and feel. Words, plus images, mockups, logos, .psd files in `design/assets/`.
- `decisions/`: choices you have made and why, so nobody (human or agent) undoes them by accident.

You can add, rename, or reorganise folders. The agents follow what they find.
