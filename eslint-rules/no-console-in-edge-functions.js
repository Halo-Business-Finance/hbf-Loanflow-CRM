/**
 * ESLint rule to prevent console.log/error/warn in edge functions
 * This ensures all logging goes through SecureLogger to prevent sensitive data exposure
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow console.log, console.error, console.warn in Supabase edge functions',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noConsoleInEdgeFunctions: 'Use SecureLogger instead of console.{{method}} in edge functions to prevent sensitive data exposure',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename();
    
    // Only apply to files in supabase/functions directory
    const isEdgeFunction = filename.includes('supabase/functions/');
    
    if (!isEdgeFunction) {
      return {};
    }

    return {
      MemberExpression(node) {
        // Check if it's console.log, console.error, or console.warn
        if (
          node.object.name === 'console' &&
          ['log', 'error', 'warn', 'info', 'debug'].includes(node.property.name)
        ) {
          context.report({
            node,
            messageId: 'noConsoleInEdgeFunctions',
            data: {
              method: node.property.name,
            },
          });
        }
      },
    };
  },
};
