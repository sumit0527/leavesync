# Deployment Fix Notes

I updated this copy for normal deployment:

1. `package.json` now has real scripts:
   - `npm run dev` -> starts Vite locally
   - `npm run build` -> creates `dist/` for Vercel/Netlify
   - `npm run preview` -> previews production build
2. `.env` was removed from this deploy-ready copy. Use `.env.example` and add environment variables in Vercel/Supabase manually.
3. `.git`, `.sync`, `node_modules`, and `dist` were removed from this deploy-ready ZIP to keep it clean.

Important: I did not find a `supabase/` folder or migration `.sql` files in the uploaded ZIP. The frontend can deploy, but the database must be created from the migration SQL before login/leave features work.
