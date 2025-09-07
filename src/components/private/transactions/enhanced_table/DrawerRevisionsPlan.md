## Drawer Revisions Implementation Plan

Goal: implement the revised Transaction Details Drawer layout shown in the mockup/HTML. Keep markup semantic, accessible, responsive, and use Tailwind utility classes already in the project.

Checklist
- [ ] Center merchant logo + name and ensure proper aspect ratio handling
- [ ] Ensure date displays the transaction local date (no timezone shift)
- [ ] Make amount, transaction number and category rows visually clearer and consistent
- [ ] Add accessible focus/keyboard behaviour for the drawer controls
- [ ] Keep dividers, spacing and rounded boxes matching the mockup
- [ ] Test responsive behaviour at mobile/sm/desktop widths

High-level plan
1. Update component structure in `TransactionDetailsDrawer.tsx` to match the mockup HTML: an upper header area (logo + merchant name centered), a compact info list (date, amount, transaction #, category), then the details blocks (description box, notes, additional fields).
2. Update CSS/Tailwind classes on the header and logo/name to center them horizontally and vertically and preserve logo aspect ratio.
3. Ensure date parsing uses the YYYY-MM-DD → local date parse approach (already implemented: `new Date(year, month-1, day)`), and use the same helper for all places in the drawer and for the date picker display.
4. Ensure optimistic updates use `category_id` and `merchant_id` (server API changes already applied). No UI change needed besides reflecting saved state.
5. Accessibility: images must have alt text, merchant name should be in a heading or aria-label, controls should have usable labels and keyboard focus states.

Files to edit
- `src/components/private/transactions/enhanced_table/TransactionDetailsDrawer.tsx` (primary)
- `src/styles/globals.css` (if you need small custom rules: image aspect or toast overrides)

Concrete step-by-step changes

1) Header (logo + merchant name)
- Replace the current header block with a flex container that centers both items.
- Example Tailwind structure:

  - Parent: `div className="flex justify-center items-center gap-4 py-6"`
  - Logo: `<img className="w-16 h-16 rounded-xl object-contain border border-border" alt="{merchantName} logo" ... />`
  - Name: `<div className="text-2xl font-semibold text-center leading-none">{merchantName}</div>`

Notes:
- Use `object-contain` (or `object-cover` if preferred) and set both width and height to keep layout consistent. Avoid only setting one dimension so React image warns won't appear.
- If using Next/Image, include `style={{ width: '64px', height: '64px', objectFit: 'contain' }}` or `sizes`/`priority` as appropriate.

2) Info row (Date / Amount / Transaction # / Category)
- Use a vertical stack of `div` rows with `flex justify-between items-center py-2 border-b border-border/50` (already used in the mockup). Keep the left label as `text-sm text-muted-foreground` and right value as `text-sm font-medium` (or `font-mono` for transaction number).
- For Amount place the value in a right-aligned container; for emphasized amount use `text-2xl font-semibold text-emerald-400` (or project color token).

3) Description box, Notes, Additional fields
- Keep the rounded mono-font box for transaction details: `div className="text-sm border border-border rounded-md p-2 font-mono"`.
- Notes block: `div className="text-xs border border-border p-2 rounded-md italic text-muted-foreground"`.

4) Category display
- Show category with icon and name inline: `div className="flex items-center gap-2 text-right"` and inside show icon then name. Use the same lucide icon mapping already in the project.

5) Accessibility and small polish
- Ensure merchant image has `alt="{merchantName} logo"` and `loading="lazy"`.
- Ensure the merchant name container is announced for screen readers; add `role="heading" aria-level={2}` or use `<h3>`.
- Button controls in header already have accessible labels—verify `aria-label` attributes on edit/delete/close.

6) Date picker & edit flow
- When rendering the date label and the date picker trigger, parse the YYYY-MM-DD string to local `Date` via `const [y,m,d] = date.split('-').map(Number); new Date(y, m-1, d)` and format with `date-fns/format` or `toLocaleDateString` as used.

7) Responsive checks
- At small widths, stack the header elements vertically: `flex-col sm:flex-row` or rely on `justify-center` and reduce the logo/name size (`w-12 h-12` at `sm:w-16 h-16`).

8) Testing checklist
- Open app, navigate to Transactions → click a transaction → drawer opens.
- Verify merchant logo + name horizontally centered, no image warning in console.
- Verify date displays as the DB date (no day-offset). Change date via picker and save; confirm server reflects YYYY-MM-DD.
- Select a merchant, save, verify optimistic update persists after revalidation.
- Change category, save, confirm `category_id` is populated and persists.
- Resize to mobile width and verify layout does not break.

Quality gates before merge
- Run the dev server and reproduce the drawer behavior. Check console for warnings.
- Run TypeScript build/lint: ensure no type errors in `TransactionDetailsDrawer.tsx`.
- Run the transaction edit flow end-to-end (pick merchant/category, save, verify DB/response).

Notes / rationale
- The mockup favors clear separation between summary info (date/amount/txn#) and the dense details box. Using Tailwind utility classes keeps the drawer consistent with project style tokens and speeds development.
- The date parse change prevents local timezone shifts that display the previous day when a date-only value is interpreted as UTC midnight.

If you want, I can implement the exact JSX edits and run the local dev server to verify — tell me to proceed and I'll make the live edits and run the checks.
