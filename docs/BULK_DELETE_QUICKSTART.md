# Quick Start Guide: Bulk Invoice Deletion

## For Administrators

### Accessing the Feature

1. **Login as admin** to the mobiFaktura system
2. Navigate to **Settings** (gear icon in navigation)
3. Scroll down to find the **"Danger Zone"** section (red bordered card)
4. Click **"Show admin options"**
5. Click **"Bulk Delete Invoices"** button

### Basic Usage

#### Step 1: Choose Your Filter
Select one of three filter types:

- **Older than X months**: Remove old invoices (e.g., 2 months)
- **Specific year/month**: Remove invoices from a particular period
- **Date range**: Remove invoices between two dates

#### Step 2: Select Status (Optional)
Choose which invoice statuses to delete:
- All statuses
- Pending
- In Review
- Accepted
- Rejected
- Re-review

#### Step 3: Enter Admin Password
For security, you must enter your admin password to proceed.

#### Step 4: Preview
Click **"Search Invoices"** to see how many invoices match your criteria.
The system will show:
- Total count of matching invoices
- Preview of first 5 invoices
- Their details (number, status, date)

#### Step 5: Confirm Deletion
Review the preview carefully. If correct, click **"Delete all (X)"**

#### Step 6: Monitor Progress
Watch the progress bar and log terminal:
- Progress bar shows completion percentage
- Statistics show: Found / Deleted / Errors
- Log terminal shows each operation in real-time

#### Step 7: Verify Success
After completion:
- System verifies all invoices are deleted
- Success message appears
- Final statistics displayed
- Log shows complete operation history

### Example: Delete Old Accepted Invoices

```
Filter: Older than X months
Months: 2
Status: Accepted
Password: [your admin password]

Click "Search Invoices" → Shows "Found 45 invoices"
Click "Delete all (45)" → Deletion begins
Wait for completion → "Operation completed successfully!"
```

### Safety Features

✅ **Password Protected** - Requires your admin password
✅ **Preview First** - See what will be deleted before confirming  
✅ **Step-by-Step Verification** - Each invoice is checked after deletion
✅ **Detailed Logging** - Complete audit trail of operations
✅ **Error Handling** - Continues even if some deletions fail
✅ **Final Verification** - System confirms all deletions completed

### Important Notes

⚠️ **THIS ACTION IS IRREVERSIBLE**
- Deleted invoices CANNOT be recovered
- Files are permanently removed from storage
- Database records are permanently deleted

⚠️ **DO NOT CLOSE THE WINDOW**
- Keep the dialog open during deletion
- Process cannot be paused or cancelled
- Closing may leave system in inconsistent state

⚠️ **REVIEW CAREFULLY**
- Double-check your filters before confirming
- Preview shows exactly what will be deleted
- Consider creating a backup first

### What Gets Deleted

For each invoice:
1. ✅ Image file from MinIO storage
2. ✅ Database record from PostgreSQL
3. ✅ All associated metadata

### When to Use This Feature

**Good Use Cases:**
- Regular cleanup of old accepted invoices
- Removing test data after migrations
- Compliance-required data retention policies
- Freeing up storage space

**Bad Use Cases:**
- Deleting invoices under active investigation
- Removing invoices that may be needed for audits
- Panic deletion without proper review

### Troubleshooting

**Problem**: Password not accepted
- **Solution**: Ensure you're using correct admin password
- **Solution**: Check Caps Lock is off

**Problem**: No invoices found
- **Solution**: Check your filter criteria
- **Solution**: Verify invoices exist with those parameters

**Problem**: Some deletions failed
- **Solution**: Check log terminal for specific errors
- **Solution**: May need to manually delete failed invoices
- **Solution**: Contact system administrator

**Problem**: Operation taking too long
- **Solution**: This is normal for large numbers of invoices
- **Solution**: Each invoice is processed individually for safety
- **Solution**: Do not close the window

### Best Practices

1. **Schedule Downtime** - Perform during low-usage periods
2. **Backup First** - Create database backup before large deletions
3. **Start Small** - Test with small batches first
4. **Review Logs** - Check log terminal for any issues
5. **Document** - Note what was deleted and when
6. **Verify** - Check system storage usage after completion

### Need Help?

If you encounter issues:
1. Take a screenshot of the log terminal
2. Note the exact filters used
3. Record any error messages
4. Contact system administrator
5. Do not attempt to re-run without investigation

### Security Reminder

This feature has been designed with multiple safety measures:
- Hidden by default in settings
- Requires password confirmation
- Shows clear warnings
- Provides complete audit trail
- Verifies each deletion

**Always exercise caution when using deletion features.**
