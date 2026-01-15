/**
 * ESLint rule to prevent hardcoded /venues/ paths in navigation
 *
 * This rule catches patterns like:
 * - navigate(`/venues/${venueSlug}/...`)
 * - to={`/venues/${venueSlug}/...`}
 * - href={`/venues/${venueSlug}/...`}
 *
 * Instead, developers should use:
 * - navigate(`${fullBasePath}/...`)
 * - to={`${fullBasePath}/...`}
 *
 * Where fullBasePath comes from useCurrentVenue() hook
 */
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded /venues/ paths in navigation. Use fullBasePath from useCurrentVenue() instead.',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noHardcodedVenuePath:
        'Avoid hardcoded /venues/ paths. Use `fullBasePath` from useCurrentVenue() hook instead. ' +
        'This ensures white-label routes (/wl/:slug) work correctly. ' +
        'Example: navigate(`${fullBasePath}/settings`) instead of navigate(`/venues/${venueSlug}/settings`)',
    },
    schema: [],
  },
  create(context) {
    return {
      TemplateLiteral(node) {
        const sourceCode = context.getSourceCode();
        const text = sourceCode.getText(node);

        // Check for /venues/${venueSlug} or /venues/${venue.slug} patterns
        if (/\/venues\/\$\{venue/.test(text)) {
          const filename = context.getFilename();

          // Exclude files in Organization directory (intentional cross-context navigation)
          if (filename.includes('/Organization/')) {
            return;
          }

          // Exclude service files (API endpoints, not navigation)
          if (filename.includes('/services/')) {
            return;
          }

          // Exclude API endpoint paths (they contain /api/)
          if (/\/api\//.test(text)) {
            return;
          }

          // Exclude test files
          if (filename.includes('.test.') || filename.includes('.spec.') || filename.includes('/test/')) {
            return;
          }

          // Exclude superadmin files (Control Plane - intentional cross-context navigation)
          if (filename.includes('/Superadmin/') || filename.includes('/Admin/') || filename.includes('superadmin')) {
            return;
          }

          // Exclude deprecated files
          if (filename.includes('DEPRECATED')) {
            return;
          }

          // Exclude context files (they handle routing at a higher level)
          if (filename.includes('/context/')) {
            return;
          }

          // Exclude Sidebar (venue switcher navigates across venues)
          if (filename.includes('/Sidebar/')) {
            return;
          }

          // Exclude PaymentSetupWizard (used in both superadmin and venue contexts)
          if (filename.includes('PaymentSetupWizard')) {
            return;
          }

          context.report({
            node,
            messageId: 'noHardcodedVenuePath',
          });
        }
      },
    };
  },
};
