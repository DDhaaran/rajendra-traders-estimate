# Quotation Maker

GST quotation maker for Rajendra Traders. Works offline on iPhone, Mac and Android.
Creates a PDF with Indian number format, rounded grand total and the Weber price list built in.

Customer names, prices and quotations are never uploaded anywhere. They stay on the device you use, separately for each signed-in account.

Sign-in and account creation use Supabase Auth with email/password. To enable them, create a Supabase project and set its Project URL and publishable/anon key in `auth-config.js`. Set the deployed app URL as the Supabase Site URL and add it to the redirect URL allow list. Never put a Supabase `service_role` key in this app.

Authentication does not sync quotation data between devices. Each account's settings, product list and draft remain local to that browser/device.
On first sign-in in a browser, any existing local quotation data is assigned to that first account.

The current quotation is saved on your device as a draft. After you successfully share a quotation, the app automatically clears it and starts a blank quotation. If sharing is canceled or fails, your draft stays available.

The same installable web app link adapts its interface to the platform: iOS-style on iPhone and Material-inspired on Android. It remains a web app/PWA, rather than a native App Store or Play Store application.

The business name, tagline, quotation title, GSTIN and address are fixed for all users of the published app. Only the repository owner can change them by updating the app source. Other users can still customize their own quotation defaults, terms and product list on their device.
