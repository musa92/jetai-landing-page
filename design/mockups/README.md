# Product mockups

Source for the app screenshots on the homepage (`assets/shots/app-mac.webp`, `assets/shots/app-iphone.webp`).
Built as HTML in Apple's UI language (SF Pro via the system font, Apple system colors, macOS/iOS layout),
then rendered at 2x with a transparent background.

To change a number or a screen: edit the HTML, render the `.win` / `.device` element at
`deviceScaleFactor: 2` with `omitBackground: true` (Chrome or Puppeteer, on a Mac so SF Pro is used),
and save as WebP over the files in `assets/shots/`.

The figures shown are illustrative product UI, kept consistent across both screens
(GT-07: 552 h remaining, 23 days to predicted fault, 87% confidence).
