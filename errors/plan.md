# Error Fixes Plan

## Overview
This document tracks all identified errors from the production logs and their fixes.

## Summary of All Errors Found (Updated with files 12-19)

### Critical Errors (Breaking functionality)
1. **Export tracking database constraint violation** - Blocks export analytics (FIXED ✅)
2. **Webhook signature verification failure** - Breaks render completion notifications (FIXED ✅)
3. **Auth PKCE code verifier failure** - Users cannot authenticate (NEW - CRITICAL)
4. **Response truncation in edit operations** - Edit fails on large scenes >19KB (NEW)
5. **AVIF image format not supported** - Fails when users upload AVIF images
6. **Base64 image encoding corruption** - Different from AVIF, affects uploads (NEW)
7. **Failed scene has no code** - Causes render pipeline to include broken scenes
8. **Anthropic API 529 overload** - Service unavailable during peak times (NEW)

### Non-Critical Errors (Degraded experience)
9. **Playwright browser missing** - Web scraping features fail
10. **Image recreator tool validation** - Tool selected without images available
11. **Duplicate project title constraint** - Title generation conflicts (NEW)

## Error 1: Database Constraint Violation - Exports Table

### Error Details
```
null value in column "id" of relation "bazaar-vid_exports" violates not-null constraint
```

### Root Cause
The `trackExportStart` function in `/src/server/services/render/export-tracking.service.ts` was relying on the database's `defaultRandom()` function to generate UUIDs, but this wasn't working during insert operations.

### Fix Applied ✅
**File**: `/src/server/services/render/export-tracking.service.ts`
**Line**: ~40

Added explicit UUID generation:
```typescript
const [exportRecord] = await db.insert(exports).values({
  id: crypto.randomUUID(), // Added this line
  userId: params.userId,
  projectId: params.projectId,
  // ... rest of the values
})
```

### Status
- [x] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 2: Webhook Signature Verification

### Error Details
```
ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH: Input buffers must have the same byte length
```

### Root Cause
1. Remotion uses SHA-512 for webhook signatures, not SHA-256
2. Buffer length mismatch when comparing signatures
3. Special case handling needed for "NO_SECRET_PROVIDED" signature

### Fix Applied ✅
**File**: `/src/app/api/webhooks/render/route.ts`
**Changes**:
1. Changed from SHA-256 to SHA-512 for signature generation
2. Added length check before buffer comparison to prevent error
3. Added special case handling for missing secrets

```typescript
// Changed from sha256 to sha512
const expectedSignature = crypto
  .createHmac("sha512", secret)
  .update(body)
  .digest("hex");

// Prevent length mismatch error
if (signature.length !== expectedSignature.length) {
  return false;
}
```

### Status
- [x] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 3: Playwright Browser Missing

### Error Details
```
Executable doesn't exist at /tmp/ms-playwright/chromium_headless_shell-1179/chrome-linux/headless_shell
```

### Root Cause
Playwright browsers not installed in production environment.

### Proposed Fix
1. Option A: Install Playwright browsers in production Docker image
2. Option B: Disable web scraping features in production
3. Option C: Use a separate service for web scraping

### Status
- [ ] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 4: Image Recreator Tool - Validation Error

### Error Details
```
At least one image URL is required
```

### Root Cause
1. Brain orchestrator selecting `imageRecreatorScene` tool based on keywords like "screenshot"
2. Tool validation happens after selection, not before
3. Fallback to addScene tool works but creates confusion

### Proposed Fix
1. Add image availability check in brain prompt
2. Validate tool requirements in orchestrator before execution
3. Better user feedback when no images are available

### Status
- [ ] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 5: Image Format Not Supported (AVIF)

### Error Details
```
messages.0.content.3.image.source.base64.data: The file format is invalid or unsupported
```

### Root Cause
1. Anthropic API doesn't support AVIF image format
2. AVIF images are being uploaded and stored successfully
3. When sent to Anthropic API for image recreation, they fail with format error

### Impact
Users uploading AVIF images (common from modern browsers/devices) get a "Failed Image Recreation" scene instead of the expected content.

### Proposed Fix
1. **Option A**: Convert AVIF to JPEG/PNG during upload process
2. **Option B**: Convert AVIF before sending to Anthropic API
3. **Option C**: Validate and reject AVIF during upload with clear message

### Status
- [ ] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 6: Failed Scene Rendering Without Code

### Error Details
```
Scene name: 'Failed Image Recreation'
hasTsxCode: false
[Preprocess] No code found for scene 0682a038-0d0b-4e56-b006-b45937af0aab
```

### Root Cause
1. When image recreation fails, a placeholder scene is created
2. This scene has no TSX code but is included in the render pipeline
3. Render process tries to render empty scenes

### Impact
1. Renders include blank/broken scenes
2. User confusion when export has empty sections
3. Wasted render time on failed scenes

### Fix Applied ✅
**Files Modified**:
1. `/src/server/services/render/render.service.ts`
2. `/src/server/api/routers/render.ts`

**Changes**:
1. **Enhanced preprocessing** to mark scenes without code as errors:
   ```typescript
   if (!scene.tsxCode) {
     return { 
       error: 'Scene has no code to render',
       sceneId: scene.id,
       sceneName: scene.name 
     };
   }
   ```

2. **Robust filtering** in `prepareRenderConfig`:
   - Skip scenes with errors
   - Skip scenes without compiled code
   - Skip scenes without source code
   - Log each filtered scene for debugging

3. **Early filtering** in API router:
   - Filter scenes before sending to render service
   - Better error messages when no valid scenes
   - Update duration calculations

### Status
- [x] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Priority Order for Fixes

### Immediate (Already Fixed)
1. ✅ **Export tracking ID** - Already fixed with crypto.randomUUID()
2. ✅ **Webhook signature** - Already fixed with SHA-512 and length check

### Critical Priority (Blocking core functionality)
3. **Auth PKCE failure** - Users cannot log in at all
4. **Response truncation** - Edit operations fail on complex scenes
5. **API 529 overload** - Service unavailable during peak times

### High Priority (User-facing issues)
6. **AVIF image support** - Users can't use modern image formats
7. **Base64 image corruption** - Additional image upload failures
8. **Failed scene rendering** - Broken scenes in exports
9. **Large audio uploads** - 413 errors for files >4.5MB

### Medium Priority (Degraded features)
10. **Duplicate project titles** - Creation fails with poor UX
11. **Playwright browser** - Web scraping features unavailable
12. **Image recreator validation** - Confusing error messages

## Analysis Summary

### Total Errors Analyzed
- **19 error log files** analyzed
- **11 unique error types** identified
- **2 errors already fixed** (export tracking, webhooks)
- **9 errors need fixes** (including 3 critical)

### Error Patterns
1. **Authentication**: PKCE verification failures blocking login
2. **API Limitations**: Response truncation, 529 overload errors
3. **Image Processing**: AVIF format + base64 encoding issues
4. **Infrastructure**: Missing dependencies and platform limits
5. **Data Constraints**: Duplicate titles, missing IDs
6. **Scene Generation**: Failed scenes polluting render pipeline

### User Impact Analysis
- **CRITICAL**: Auth failures completely block access
- **CRITICAL**: Edit truncation breaks core editing functionality
- **HIGH**: Image upload failures (AVIF + base64 corruption)
- **HIGH**: API overload causes intermittent failures
- **MEDIUM**: Failed scenes, duplicate titles, large files
- **LOW**: Web scraping unavailable

### New Critical Findings (Files 12-19)
1. Authentication is broken due to PKCE verifier issues
2. Edit operations fail silently when responses exceed ~16KB
3. Anthropic API overload (529) not properly handled
4. Two separate image issues: AVIF format AND base64 corruption
5. Project title generation has insufficient uniqueness

## Deployment Checklist

### Pre-deployment
- [x] Export tracking fix tested
- [x] Webhook signature fix tested
- [ ] AVIF conversion solution implemented
- [ ] Scene filtering implemented
- [ ] All fixes tested locally
- [ ] Code reviewed

### Deployment
- [ ] Deploy to staging
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Monitor logs for 24 hours

### Post-deployment
- [ ] Verify export tracking works
- [ ] Verify webhooks process correctly
- [ ] Test AVIF image uploads
- [ ] Verify renders exclude failed scenes
- [ ] Update documentation
- [ ] Notify team of fixes

## Technical Notes

### Export Tracking Fix
- Database was expecting UUID but not generating it
- Added explicit `crypto.randomUUID()` in insert statement
- No database migration needed

### Webhook Signature Fix
- Remotion uses SHA-512, not SHA-256
- Added buffer length check to prevent crypto error
- Handles "NO_SECRET_PROVIDED" special case

### AVIF Image Issue
- Modern browsers save screenshots as AVIF
- Anthropic API only supports JPEG, PNG, GIF, WebP
- Need image conversion pipeline

### Failed Scene Issue
- Image recreation failures create placeholder scenes
- These scenes have metadata but no code
- Render pipeline should skip them

---

## Error 7: Auth PKCE Code Verifier (NEW - CRITICAL)

### Error Details
```
InvalidCheck: pkceCodeVerifier value could not be parsed
```

### Root Cause
1. NextAuth callback receiving malformed or missing PKCE code verifier during OAuth flow
2. Cookie issues preventing PKCE verifier storage/retrieval
3. Browser privacy settings blocking third-party cookies
4. Session mismatch between auth start and callback

### Impact
Users cannot authenticate - completely blocks access to the application.

### Fix Applied ✅ (Step 1 - Immediate)
**File**: `/src/server/auth/config.ts`
**Change**: Added `checks: ["state"]` to GoogleProvider

```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  allowDangerousEmailAccountLinking: true,
  checks: ["state"], // Use state instead of PKCE to fix login issues
})
```

This disables PKCE checks while maintaining state parameter validation for CSRF protection.

### Step 2 (To Be Implemented)
Fix cookie configuration to properly support PKCE:
```typescript
cookies: {
  pkceCodeVerifier: {
    options: {
      sameSite: "lax",  // Change from strict/none
      secure: true,
      httpOnly: true
    }
  }
}
```

### Status
- [x] Fixed (Step 1 - Immediate fix)
- [ ] Step 2 - Cookie configuration
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 8: Response Truncation in Edit Operations (NEW)

### Error Details
```
[EDIT TOOL DEBUG] TRUNCATION DETECTED!
Expected length: 19719, Actual length: 16384
```

### Root Cause
Claude's responses are being truncated when they exceed ~16-19KB during edit operations. The JSON response is cut off mid-stream, causing parse failures.

### Impact
Users cannot edit complex scenes. Edit operations fail silently without applying changes.

### Proposed Fix
1. Implement response chunking for large edits
2. Use streaming responses properly
3. Split large edit operations into smaller chunks
4. Add proper error handling for truncated responses

### Status
- [ ] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 9: Anthropic API 529 Overload (NEW)

### Error Details
```
529 {"type":"overloaded_error","message":"Overloaded"}
```

### Root Cause
Anthropic API returning 529 errors during high load periods. Current retry logic insufficient.

### Impact
Edit and generation operations fail intermittently, degrading user experience during peak times.

### Proposed Fix
1. Implement exponential backoff with jitter
2. Add request queuing system
3. Consider fallback to different model during overload
4. Add user notification about temporary unavailability

### Status
- [ ] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 10: Base64 Image Encoding Corruption (NEW)

### Error Details
```
messages.0.content.3.image.source.base64.data: The file format is invalid or unsupported
```

### Root Cause
Different from AVIF issue - this appears to be base64 encoding corruption during image upload/processing.

### Impact
Scene generation fails when using certain uploaded images, even if they're in supported formats.

### Proposed Fix
1. Validate base64 encoding before sending to API
2. Re-encode images during upload process
3. Add checksum validation for image data
4. Implement proper error messages for users

### Status
- [ ] Fixed
- [ ] Deployed to production
- [ ] Verified in logs

---

## Error 11: Duplicate Project Title Constraint (NEW)

### Error Details
```
duplicate key value violates unique constraint "project_unique_name"
```

### Root Cause
Title generation creates duplicate names when users create multiple similar projects. Retry logic exists but still fails after 3 attempts.

### Impact
Project creation fails with poor error messaging. Users must manually enter unique titles.

### Proposed Fix
1. Improve title generation uniqueness (add timestamp/random suffix)
2. Increase retry attempts with better variation
3. Remove unique constraint or scope it per user
4. Better error messaging for users

### Status
- [ ] Fixed
- [ ] Deployed to production
- [ ] Verified in logs