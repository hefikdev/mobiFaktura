# mobiFaktura - User Guide

**Version:** 1.0  
**Last Updated:** January 29, 2026  
**Target Audience:** End Users

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Logging In](#logging-in)
3. [Dashboard](#dashboard)
4. [Uploading Invoices](#uploading-invoices)
5. [Viewing Your Invoices](#viewing-your-invoices)
6. [Budget Requests](#budget-requests)
7. [Balance (Saldo)](#balance-saldo)
8. [Advances (Zaliczki)](#advances-zaliczki)
9. [Notifications](#notifications)
10. [Settings](#settings)
11. [Mobile App (PWA)](#mobile-app-pwa)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)

---

## Getting Started

### What is mobiFaktura?

mobiFaktura is a web-based system for managing invoices and financial requests. You can:
- Upload invoices from your phone or computer
- Track invoice approval status
- Request budget increases
- View your balance (saldo)
- Get notifications when your invoices are processed

### System Requirements

**Desktop:**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection

**Mobile:**
- Smartphone with camera
- Modern mobile browser
- Internet connection
- Optional: Install as mobile app (PWA)

### Getting Access

Your system administrator will provide:
- Website URL (e.g., https://faktura.yourcompany.com)
- Email address
- Initial password

**First-time login:**
1. Visit the website
2. Enter your email and password
3. (Recommended) Change your password in Settings

---

## Logging In

### Login Page

1. Go to your company's mobiFaktura URL
2. Enter your **email address**
3. Enter your **password**
4. Click **"Zaloguj się"** (Log in)

### Password Requirements

Your password must have:
- At least 8 characters
- One uppercase letter (A-Z)
- One lowercase letter (a-z)
- One number (0-9)
- One special character (!@#$%^&*)

**Example:** `MyPass123!`

### Forgot Password?

Contact your system administrator for password reset.

### Account Locked?

After 3 failed login attempts, your account is locked for 30 seconds. Wait and try again, or contact your administrator.

---

## Dashboard

### Overview

Your dashboard shows:
- Your current balance (saldo)
- Recent invoices
- Pending budget requests
- Recent activity
- Quick actions

### Quick Actions

From the dashboard, you can:
- **Upload Invoice** - Submit a new invoice
- **Request Budget** - Ask for balance increase
- **View All Invoices** - See complete invoice list
- **Check Balance** - View transaction history

---

## Uploading Invoices

### Step-by-Step Guide

#### 1. Start Upload

- Click **"Dodaj fakturę"** (Add invoice) button
  - In header (+ icon)
  - Or on dashboard

#### 2. Select Invoice Type

Choose one:
- **E-faktura** (E-invoice) - Standard electronic invoice
- **Paragon** (Receipt) - Simplified receipt

**When to use which:**
- E-faktura: For most business purchases
- Paragon: For retail receipts without VAT details

#### 3. Select Company

Choose which company this invoice is for from the dropdown menu.

**Note:** You only see companies you have permission for. Contact admin to add more.

#### 4. Take/Upload Photo

**Options:**
- **Take Photo**: Click camera icon, allow camera access, take picture
- **Upload File**: Click upload icon, select image from device

**Tips:**
- Make sure invoice is clearly visible
- Good lighting helps
- Keep the invoice flat
- All text should be readable

**Supported formats:** JPG, PNG, WebP

#### 5. Scan KSeF QR Code (E-invoices only)

If your invoice has a KSeF QR code:

1. Click **"Skanuj kod QR"** (Scan QR code)
2. Allow camera access
3. Point camera at QR code
4. System auto-fills invoice details

**What is KSeF?**
- Polish national e-invoicing system
- Vendors upload invoices to KSeF
- QR code links to invoice data
- Scanning saves time!

#### 6. Enter Invoice Details

**Required fields:**
- **Numer faktury** (Invoice number): Enter from invoice
- **Kwota** (Amount): Total amount in PLN

**Optional fields:**
- **Numer KSeF**: Auto-filled from QR, or enter manually
- **Opis** (Description): Additional notes

#### 7. Submit

Click **"Wyślij"** (Submit)

**What happens next:**
1. Image is uploaded and compressed
2. Invoice enters "Pending" status
3. Accountants are notified
4. You receive confirmation
5. You can track progress

### Upload Tips

✅ **Do:**
- Upload clear, readable photos
- Enter correct invoice number
- Double-check amount
- Add description if needed
- Use KSeF QR when available

❌ **Don't:**
- Upload blurry photos
- Submit duplicate invoices
- Enter wrong amounts
- Forget to select company

---

## Viewing Your Invoices

### Invoice List

**Access:** Click **"Moje faktury"** in menu

**Shows:**
- Invoice number
- Company name
- Amount
- Status
- Upload date

### Invoice Status

Your invoice goes through these stages:

#### 🟡 Oczekująca (Pending)
- Just uploaded
- Waiting for accountant review
- **What to do:** Wait for review

#### 🔵 W trakcie sprawdzania (In Review)
- Accountant is reviewing
- **What to do:** Wait for decision

#### 🟢 Zaakceptowana (Accepted)
- Approved!
- Amount added to your balance
- **What to do:** Nothing, you're good!

#### 🔴 Odrzucona (Rejected)
- Not approved
- See rejection reason
- **What to do:** Upload correct invoice if needed

#### 🟣 Wpłynęła (Transferred)
- Money was transferred to you
- Final confirmation

#### ⚫ Rozliczono (Settled)
- Complete and reconciled
- Closed

### Viewing Invoice Details

Click on any invoice to see:
- Full image (zoom available)
- All details
- Status history
- Rejection reason (if rejected)
- Related budget request (if any)
- Comments from accountant

**Actions:**
- **Download**: Save invoice image
- **Print**: Print for records
- **Delete**: Request deletion (requires password)
- **View Corrections**: See related corrections

### Searching Invoices

**Search box:** Enter invoice number, company name, or amount

**Filters:**
- Status: All, Pending, Accepted, Rejected, etc.
- Date range: From/to dates
- Company: Specific company
- Type: E-invoice, Receipt, Correction

---

## Budget Requests

### What is a Budget Request?

When you need to make purchases but don't have enough balance, you can request a budget increase.

### Creating a Request

1. Click **"Zwiększ budżet"** in user menu
2. Enter **amount needed** (in PLN)
3. Enter **justification** (minimum 10 characters)
4. Click **"Wyślij prośbę"** (Submit request)

**Example justification:**
```
Potrzebuję 500 zł na zakup materiałów biurowych do projektu X.
Przewidywany koszt obejmuje papier, toner i segregatory.
```

### Request Status

#### 🟡 Oczekująca (Pending)
- Waiting for accountant review
- **Action:** Wait

#### 🟢 Zatwierdzona (Approved)
- Approved!
- Balance increased
- **Action:** You can now submit invoices

#### 🔴 Odrzucona (Rejected)
- Not approved
- See rejection reason
- **Action:** Review reason, resubmit if appropriate

#### 🟣 Wpłynęła (Money Transferred)
- Funds confirmed
- **Action:** None

#### ⚫ Rozliczono (Settled)
- Complete
- Linked invoices submitted
- **Action:** None

### Viewing Requests

**Access:** User menu → **"Moje prośby"** (My requests)

**Shows:**
- Requested amount
- Current balance (at time of request)
- Justification
- Status
- Submission date
- Decision date
- Reviewer name
- Related invoices

### Request Limits

- **One pending request at a time:** Can't submit new request until current one is processed
- **Positive amounts only:** Must request more than 0 PLN
- **Justification required:** Explain why you need the budget

---

## Balance (Saldo)

### What is Saldo?

Your saldo is your available balance for invoice submissions. It:
- Increases when invoices are accepted
- Increases when budget requests are approved
- Can be adjusted by corrections
- Shows your financial activity

### Viewing Balance

**Current Balance:**
- Displayed in header (top right)
- On dashboard
- In saldo page

**Colors:**
- 🟢 Green: Positive balance
- 🔴 Red: Negative balance (if applicable)
- ⚫ Gray: Zero balance

### Transaction History

**Access:** Click saldo amount → **"Historia"** (History)

**Shows:**
- Date and time
- Transaction type
- Amount (+/-)
- Description
- Balance before/after
- Reference (invoice/request ID)

**Transaction Types:**
- ✅ **Accepted Invoice:** +amount
- 📥 **Budget Request Approved:** +amount
- 🔧 **Correction:** +/- amount
- ⚙️ **Manual Adjustment:** Admin change

### Filtering History

- **Date range:** Select from/to dates
- **Transaction type:** Filter by type
- **Search:** Find by reference ID

---

## Advances (Zaliczki)

### What are Advances?

Advances are prepayments for planned expenses. Similar to budget requests but specifically for advance payments.

**Use case:** You need money before making purchases.

### Viewing Advances

**Access:** Menu → **"Zaliczki"** (Advances)

**Shows:**
- Amount
- Purpose
- Status
- Request date
- Approval date
- Transfer date
- Settlement date

### Advance Status

- **Pending:** Waiting approval
- **Approved:** Approved, waiting transfer
- **Transferred:** Money sent
- **Settled:** Invoices submitted, closed

---

## Notifications

### Notification Bell

**Location:** Header (top right, bell icon)

**Badge:** Shows unread count

### Notification Types

You receive notifications for:
- 📄 **Invoice Accepted:** Your invoice was approved
- ❌ **Invoice Rejected:** Your invoice was declined
- 💰 **Budget Request Approved:** Budget increase approved
- ❌ **Budget Request Rejected:** Budget request declined
- 💳 **Balance Adjusted:** Your balance changed
- 🔔 **System Message:** Important announcements

### Managing Notifications

**Read notifications:**
- Click on notification to read
- Automatically marked as read
- Old notifications auto-deleted after 2 days

**Mark all as read:**
- Click **"Zaznacz wszystkie jako przeczytane"**

**Sound:**
- Notifications can play sound
- Toggle in Settings

### Notification Settings

**Access:** Settings → **"Preferencje powiadomień"**

**Options:**
- Enable/disable sound
- Enable/disable per notification type
- Keep important ones, disable others

**Example:** Disable invoice submission notifications if you upload many invoices.

---

## Settings

**Access:** Click your name (top right) → **"Ustawienia"**

### Account Information

**View only:**
- Your name
- Email
- Role
- Account creation date
- Current balance

### Change Password

1. Enter **current password**
2. Enter **new password** (must meet requirements)
3. Confirm new password
4. Click **"Zmień hasło"**

**Security:**
- All other sessions will be logged out
- You'll receive a confirmation notification

### Theme

Choose appearance:
- **Jasny (Light):** Light mode
- **Ciemny (Dark):** Dark mode
- **System:** Follow your device setting

### Notification Preferences

Toggle each notification type on/off:
- Invoice accepted ✅
- Invoice rejected ❌
- Budget request approved 💰
- Budget request rejected ❌
- Balance adjusted 💳
- System messages 🔔
- Sound alerts 🔊

### Assigned Companies

**View only:** List of companies you can submit invoices for

**To add more:** Contact your administrator

### Logout

Click **"Wyloguj się"** (Logout) to sign out

---

## Mobile App (PWA)

### Installing Mobile App

mobiFaktura can be installed as a mobile app (Progressive Web App).

**Benefits:**
- App icon on home screen
- Faster loading
- Offline support
- Native feel

### Installation Steps

#### iOS (iPhone/iPad)

1. Open Safari (must use Safari)
2. Go to mobiFaktura website
3. Tap **Share** button (square with arrow up)
4. Scroll down, tap **"Add to Home Screen"**
5. Tap **"Add"**
6. App icon appears on home screen

#### Android

1. Open Chrome (or other browser)
2. Go to mobiFaktura website
3. Tap **menu** (three dots)
4. Tap **"Add to Home Screen"** or **"Install app"**
5. Tap **"Install"**
6. App icon appears on home screen

### Using Mobile App

**Camera Access:**
- First time: Allow camera access when prompted
- Essential for invoice photos and QR scanning

**Offline Support:**
- Some pages work offline
- Uploads sync when connection returns
- Offline banner shows when disconnected

---

## Troubleshooting

### Can't Log In

**Check:**
- ✅ Email address is correct
- ✅ Password is correct (case-sensitive)
- ✅ Not locked out (wait 30 seconds after 3 failed attempts)
- ✅ Internet connection working

**Solution:** Contact administrator for password reset

### Invoice Upload Failed

**Common causes:**
- Image file too large (max 10 MB)
- Invalid file format (use JPG, PNG, WebP)
- Poor internet connection
- Server temporarily unavailable

**Solution:**
- Compress image before upload
- Check internet connection
- Try again in a few minutes

### Can't See My Invoice

**Check:**
- ✅ Using correct filters (status, company, date)
- ✅ Looking in "My Invoices" page
- ✅ Invoice was actually submitted (check confirmation)

**Solution:**
- Clear all filters
- Refresh page
- Contact accountant if still missing

### Balance Doesn't Match

**Reasons:**
- Recent invoice still pending review
- Invoice was rejected
- Correction was applied
- Admin adjustment made

**Solution:**
- Check transaction history for details
- Contact accountant if discrepancy persists

### Notifications Not Working

**Check:**
- ✅ Notifications enabled in Settings
- ✅ Browser allows notifications
- ✅ Sound enabled (if expecting sound)

**Solution:**
- Go to Settings → Enable notifications
- Check browser notification permissions

### Mobile App Issues

**Camera not working:**
- Allow camera access in phone settings
- Reload page
- Reinstall app

**App won't install:**
- Use recommended browser (Safari for iOS, Chrome for Android)
- Update browser to latest version
- Clear browser cache

---

## FAQ

### General

**Q: Who can see my invoices?**  
A: Only you, accountants, and admins. Other users cannot see your invoices.

**Q: How long does review take?**  
A: Usually 1-3 business days. You'll get a notification when processed.

**Q: Can I edit an invoice after submitting?**  
A: No. If you made a mistake, contact an accountant.

**Q: Can I delete an invoice?**  
A: Yes, but requires password confirmation and admin approval.

### Invoices

**Q: What if I upload the wrong invoice?**  
A: Contact an accountant immediately to reject it. Then upload the correct one.

**Q: Why was my invoice rejected?**  
A: Check the rejection reason in invoice details. Common reasons:
- Unclear image
- Wrong amount
- Incorrect invoice number
- Not compliant with company policy

**Q: Can I submit the same invoice twice?**  
A: No. System checks for duplicates. Each invoice should be submitted once.

**Q: What's the difference between e-invoice and receipt?**  
A:
- **E-invoice (E-faktura):** Full invoice with VAT details
- **Receipt (Paragon):** Simplified receipt without VAT

### Budget Requests

**Q: How much can I request?**  
A: Depends on your company policy. Discuss with your accountant.

**Q: Can I submit a request while one is pending?**  
A: No. Wait for current request to be processed first.

**Q: What if my request is rejected?**  
A: Review the rejection reason. You can submit a new request with better justification.

**Q: When will approved funds be available?**  
A: Immediately after approval. Check your balance.

### Balance

**Q: Where does my balance come from?**  
A: From:
- Approved invoices
- Approved budget requests
- Correction invoices
- Admin adjustments

**Q: Can my balance go negative?**  
A: Typically no, but depends on company policy.

**Q: How do I increase my balance?**  
A:
- Submit invoices that get accepted
- Request budget increase

### KSeF

**Q: What is KSeF?**  
A: Polish national e-invoicing system (Krajowy System e-Faktur).

**Q: Do I need to use KSeF?**  
A: No, it's optional. But it makes invoice upload faster.

**Q: Where do I find the KSeF QR code?**  
A: On e-invoices from vendors who use KSeF. Usually in top corner.

**Q: My QR code won't scan**  
A:
- Ensure good lighting
- Hold phone steady
- Make sure QR code is fully visible
- If fails, enter KSeF number manually

### Technical

**Q: Which browsers are supported?**  
A:
- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ❌ Internet Explorer (not supported)

**Q: Does mobiFaktura work offline?**  
A: Partially. You can view some pages offline, but uploads require internet.

**Q: Is my data secure?**  
A: Yes. All data is encrypted, passwords are hashed, and access is controlled.

**Q: Can I use multiple devices?**  
A: Yes. Your account works on any device. Sessions are synced.

---

## Getting Help

### Contact Support

**Options:**
1. **Accountant:** For invoice or budget issues
2. **Administrator:** For account or access issues
3. **IT Support:** For technical problems

### Tips for Effective Support

When contacting support, provide:
- Your email/username
- What you were trying to do
- What happened (error message, etc.)
- Screenshot if possible
- Browser/device information

**Example:**
```
Email: jan.kowalski@firma.pl
Problem: Can't upload invoice
Error: "Upload failed"
Browser: Chrome on Android
Screenshot: [attached]
```

---

## Tips for Success

### 📸 Take Clear Photos

- **Good lighting:** Natural light is best
- **Flat surface:** Lay invoice flat
- **Full frame:** Capture entire invoice
- **Focus:** Make sure text is sharp

### 📝 Enter Accurate Data

- **Double-check:** Invoice number and amount
- **Consistent:** Use same format each time
- **Complete:** Fill all required fields

### ⏰ Submit Promptly

- Upload invoices soon after purchase
- Don't wait until end of month
- Helps with timely processing

### 📊 Track Your Balance

- Check balance regularly
- Review transaction history
- Plan budget requests in advance

### 🔔 Enable Notifications

- Stay informed of status changes
- Respond quickly to rejections
- Get important announcements

---

## Keyboard Shortcuts

### Global

- **`Ctrl + K`** - Open search
- **`Ctrl + N`** - New invoice
- **`Ctrl + /`** - Show shortcuts

### Navigation

- **`G` then `H`** - Go home
- **`G` then `I`** - Go to invoices
- **`G` then `S`** - Go to settings

### Actions

- **`Esc`** - Close dialog/modal
- **`Enter`** - Submit form (when focused)

---

## Glossary

**Faktura** - Invoice  
**E-faktura** - Electronic invoice  
**Paragon** - Receipt  
**Korekta** - Correction invoice  
**Saldo** - Balance  
**Zaliczka** - Advance payment  
**Księgowy** - Accountant  
**Administrator** - Admin  
**KSeF** - Polish e-invoicing system (Krajowy System e-Faktur)  
**Oczekująca** - Pending  
**W trakcie sprawdzania** - In review  
**Zaakceptowana** - Accepted  
**Odrzucona** - Rejected  
**Wpłynęła** - Transferred  
**Rozliczono** - Settled  

---

## Conclusion

You're now ready to use mobiFaktura effectively!

**Remember:**
- Upload clear invoice photos
- Enter accurate information
- Track your balance
- Enable notifications
- Contact support when needed

**Happy invoicing! 📄💼**

---

*For technical documentation, see [FEATURES.md](FEATURES.md) and [API.md](API.md).*
