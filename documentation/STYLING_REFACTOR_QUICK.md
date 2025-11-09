# Styling Refactor & Error Fix - Quick Reference

**Date**: November 9, 2025  
**Quick Summary**: CSS class refactor + compilation error fix feature

---

## 🎯 What Changed

### 1. CSS Class Refactoring
- ✅ Extracted all inline Tailwind classes to `src/index.css`
- ✅ Created 684 lines of reusable CSS classes
- ✅ Refactored all 6 page components
- ✅ Updated App.tsx to use CSS classes

### 2. Compilation Error Fix Feature
- ✅ Added Vite plugin to detect compilation errors
- ✅ Enhanced Preview component to listen for errors
- ✅ Improved ChatAlert to format compilation errors
- ✅ Added "Ask Chef" button for compilation errors

### 3. Agent Prompt Enhancements
- ✅ Added styling guidelines to `solutionConstraints.ts`
- ✅ Added validation rules to `outputInstructions.ts`
- ✅ Prevented invalid Tailwind classes (e.g., `shadow-3xl`)

---

## 📁 Files Changed

### Template Files (7 files)
- `template/src/index.css` - Added CSS class library
- `template/src/pages/HomePage.tsx` - Refactored to CSS classes
- `template/src/pages/ProductsPage.tsx` - Refactored to CSS classes
- `template/src/pages/CartPage.tsx` - Refactored to CSS classes
- `template/src/pages/OrdersPage.tsx` - Refactored to CSS classes
- `template/src/pages/AdminDashboard.tsx` - Refactored to CSS classes
- `template/src/App.tsx` - Refactored to CSS classes
- `template/vite.config.ts` - Added error detection plugin

### App Files (2 files)
- `app/components/workbench/Preview.tsx` - Added error listener
- `app/components/chat/ChatAlert.tsx` - Enhanced error formatting

### Agent Files (2 files)
- `chef-agent/prompts/solutionConstraints.ts` - Added styling guidelines
- `chef-agent/prompts/outputInstructions.ts` - Added validation rules

---

## 🔧 Key CSS Classes

### Layout
```css
.page-container, .page-main, .page-content, .page-header
.page-title, .page-subtitle
```

### Buttons
```css
.btn-primary, .btn-secondary, .btn-success, .btn-danger
.btn-outline, .btn-link, .btn-checkout
```

### Cards
```css
.card, .card-product, .card-order, .card-admin, .card-empty
```

### Forms
```css
.form-input, .form-textarea, .form-label, .form-select
```

### Products
```css
.product-grid, .product-image-container, .product-title, .product-price
```

---

## 🐛 Error Fix Feature

### How It Actually Works (Technical)

**3-Layer Architecture**:

1. **Vite Plugin** (`template/vite.config.ts`):
   ```typescript
   transformIndexHtml(html: string) {
     // Injects script into HTML <head>
     return html.replace("</head>", `<script>/* detection code */</script></head>`);
   }
   ```
   - Runs during Vite's HTML processing
   - Injects error detection script into every page
   - Only in development mode

2. **Injected Script** (runs in iframe):
   ```javascript
   // Monitors Vite's error overlay
   const overlay = document.querySelector('#vite-error-overlay');
   if (overlay) {
     // Extract error details
     // Post to parent window
     window.parent.postMessage({
       type: 'VITE_COMPILATION_ERROR',
       error: '...',
       message: '...',
       file: '...'
     }, '*');
   }
   ```
   - Checks every 1 second for error overlay
   - Extracts error details from DOM
   - Uses `postMessage` to send to parent
   - Deduplicates to prevent spam

3. **Preview Component** (`app/components/workbench/Preview.tsx`):
   ```typescript
   window.addEventListener('message', (event) => {
     if (event.data?.type === 'VITE_COMPILATION_ERROR') {
       workbenchStore.actionAlert.set({ ... });
     }
   });
   ```
   - Listens for messages from iframe
   - Validates source (security)
   - Sets `actionAlert` in store
   - ChatAlert automatically displays

### Complete Flow

```
┌─────────────────────────────────────────┐
│ 1. User writes: shadow-3xl (invalid)    │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 2. Vite detects error                   │
│    - PostCSS processes CSS              │
│    - Finds invalid class                │
│    - Creates #vite-error-overlay         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 3. Injected script detects overlay      │
│    - setInterval checks every 1s         │
│    - Extracts: title, message, file      │
│    - Deduplicates (compares text)         │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 4. Script posts message                 │
│    window.parent.postMessage({            │
│      type: 'VITE_COMPILATION_ERROR',     │
│      error: '...',                       │
│      message: '...'                      │
│    }, '*')                               │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 5. Preview component receives           │
│    - Validates source                   │
│    - Sets actionAlert                   │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 6. ChatAlert displays                   │
│    - Shows error details                │
│    - "Ask Chef" button                  │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 7. User clicks "Ask Chef"                │
│    - Formats error message              │
│    - Sends to chat                      │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│ 8. Agent fixes error                    │
│    shadow-3xl → shadow-2xl              │
└─────────────────────────────────────────┘
```

### Key Technical Details

**Why HTML Injection?**
- Can't access iframe DOM directly (CORS/sandbox)
- Script runs in iframe context (has access)
- No external loading needed

**Why setInterval?**
- More reliable than MutationObserver
- Works even if DOM doesn't mutate
- 1-second interval is negligible

**Why postMessage?**
- Standard cross-frame communication
- Works with iframe sandboxing
- Secure (validates source)

**Deduplication**:
```javascript
if (details.fullText !== lastErrorText) {
  // Only send if error changed
}
```

**Security**:
- Validates `event.source === node.contentWindow`
- Checks message type before processing
- No eval or innerHTML

### Example Flow

```
User writes: shadow-3xl (invalid)
    ↓
Vite shows error overlay
    ↓
Error detection script extracts error
    ↓
ChatAlert appears with "Ask Chef"
    ↓
User clicks button
    ↓
Error sent to chat: "*Fix this compilation error*..."
    ↓
Agent fixes: shadow-3xl → shadow-2xl
```

---

## ✅ Validation Rules

### Tailwind Classes

**Valid Shadow Classes**:
- ✅ `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`
- ❌ `shadow-3xl`, `shadow-4xl`, `shadow-5xl` (DO NOT USE)

**Valid Spacing**:
- Use standard scale: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96

### CSS Class Guidelines

1. **Always check `src/index.css` first** for existing classes
2. **Use semantic class names** (e.g., `.btn-primary` not `.blue-button`)
3. **Organize by component type** (buttons, cards, forms, etc.)
4. **Validate Tailwind classes** before using in `@apply`
5. **Test deployment** to catch invalid classes early

---

## 🚀 Usage Examples

### Before (Inline Tailwind)
```tsx
<button className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
  Click me
</button>
```

### After (CSS Class)
```tsx
<button className="btn-primary">
  Click me
</button>
```

### Adding New Class
```css
/* In src/index.css */
.btn-custom {
  @apply px-6 py-3 bg-blue-500 text-white rounded-lg shadow-md;
}
```

```tsx
/* In component */
<button className="btn-custom">Custom Button</button>
```

---

## 🔍 Testing Checklist

### CSS Refactoring
- [ ] All pages render correctly
- [ ] Buttons styled properly
- [ ] Cards display correctly
- [ ] Forms work as expected
- [ ] Responsive design intact
- [ ] Hover states function

### Error Detection
- [ ] Create invalid Tailwind class
- [ ] Verify ChatAlert appears
- [ ] Click "Ask Chef" button
- [ ] Confirm error sent to chat
- [ ] Verify agent fixes error

---

## 📊 Impact Summary

| Metric | Value |
|--------|-------|
| **Files Modified** | 11 |
| **CSS Classes Added** | 684 lines |
| **Components Refactored** | 6 pages + App |
| **New Features** | 2 |
| **Lines Changed** | ~1,500 |
| **Breaking Changes** | 0 |

---

## 🎓 For Developers

### When Adding Styles

1. Check `src/index.css` for existing class
2. If exists, use it
3. If not, add new class to appropriate section
4. Use `@apply` with valid Tailwind classes
5. Test deployment

### When Fixing Errors

1. Read error message
2. Identify invalid class
3. Replace with valid class
4. Update CSS if needed
5. Re-deploy

---

## 🎓 For AI Agent

### Styling Guidelines

1. **ALWAYS** use CSS classes from `src/index.css`
2. **NEVER** use inline Tailwind classes
3. **CHECK** `src/index.css` before adding new styles
4. **VALIDATE** Tailwind classes before using
5. **TEST** deployment to catch errors

### Error Handling

1. **DETECT** compilation errors automatically
2. **FORMAT** errors correctly (CSS for PostCSS errors)
3. **FIX** invalid classes immediately
4. **VERIFY** fix works after deployment

---

## 🔗 Related Documentation

- **Detailed Docs**: `documentation/STYLING_REFACTOR_DETAILED.md`
- **Quick Reference**: `documentation/QUICK_REFERENCE.md`
- **Architecture**: `documentation/ARCHITECTURE_FLOW.md`

---

**Quick Reference Version**: 1.0  
**Last Updated**: November 9, 2025

