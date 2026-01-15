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
          // Exclude files in Organization directory (intentional cross-context navigation)
          const filename = context.getFilename();
          if (filename.includes('/Organization/')) {
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
