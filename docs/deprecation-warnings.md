# Known Deprecation Warnings

## DEP0060: util._extend Deprecation Warning

When running the frontend development server with `yarn start:stage`, you may encounter the following deprecation warning:

```code
(node:xxxxx) [DEP0060] DeprecationWarning: The `util._extend` API is deprecated. Please use Object.assign() instead.
    at ProxyServer.<anonymous> (/Users/.../node_modules/http-proxy/lib/http-proxy/index.js:50:26)
    at HttpProxyMiddleware.middleware (/Users/.../node_modules/http-proxy-middleware/dist/http-proxy-middleware.js:22:32)
```

### What causes this warning?

This warning originates from the `http-proxy@1.18.1` library, which is a transitive dependency used by:

- `webpack-dev-server@5.2.2` (our dev dependency)
- `http-proxy-middleware@2.0.9` (dependency of webpack-dev-server)

The `http-proxy` library still uses the deprecated `util._extend()` API instead of the modern `Object.assign()`.

### Is this harmful?

**No, this warning is completely harmless:**

- The functionality works exactly the same
- `util._extend()` still functions correctly in all supported Node.js versions
- This is purely a deprecation notice, not an error
- It does not affect the application's functionality or performance

### When will this be fixed?

This will be resolved when:

1. The upstream `http-proxy` library is updated to use `Object.assign()` instead of `util._extend()`
2. OR when `webpack-dev-server` switches to a different proxy implementation
3. OR when we upgrade to newer versions that have resolved this issue

### React 19 Compatibility

This deprecation warning will not prevent upgrading to React 19 or any future React versions, as it's unrelated to React and only affects the development server's proxy functionality.

### Alternative Solutions Considered

1. **Patching the library**: We could patch `http-proxy` to use `Object.assign()`, but this adds maintenance overhead
2. **Suppressing warnings**: We could use `NODE_OPTIONS='--no-deprecation'` to hide all deprecation warnings, but this might hide other important warnings
3. **Yarn resolutions**: We could try to force a different version, but `1.18.1` is already the latest

For now, we've decided to leave the warning visible as it's informational and doesn't impact functionality.
