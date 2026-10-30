# Wedding Gallery

A static page where friends and family can view and download wedding photos.

Photos are read from the `photos` Supabase Storage bucket. Organize them into
folders to show a capsule filter for each folder; **All** displays every photo.
Nested folders are supported, and selecting a parent folder includes its
subfolders.
Use the plus buttons on thumbnails or in the photo viewer to select pictures.
The checkout panel lets you review and remove selections, then download them
together as a ZIP archive.

## Local development

    npm install
    npm run dev

## Deploying

Every push to `main` builds the site and publishes it to GitHub Pages
(see `.github/workflows/deploy.yml`).

One-time setup: in the GitHub repo go to **Settings > Pages** and set
**Source** to **GitHub Actions**.
