import type TreeSitterParser from 'tree-sitter';
import type { BaseExtractor } from './base-extractor';
import { NodeUtils } from './base-extractor';

/**
 * Extractor for function-related nodes (functions, methods, arrow functions)
 */
export class FunctionExtractor implements BaseExtractor {
  getSupportedTypes(): string[] {
    return [
      'function_declaration',
      'function_expression',
      'generator_function_declaration',
      'async_function_declaration',
      'method_definition',
      'arrow_function',
      'constructor',
    ];
  }

  extractName(
    node: TreeSitterParser.SyntaxNode,
    source: string
  ): string | undefined {
    switch (node.type) {
      case 'function_declaration':
      case 'function_expression':
      case 'generator_function_declaration':
      case 'async_function_declaration':
        return this.extractFunctionName(node, source);

      case 'method_definition':
        return this.extractMethodName(node, source);

      case 'arrow_function':
        return this.extractArrowFunctionName(node, source);

      case 'constructor':
        return 'constructor';

      default:
        return undefined;
    }
  }

  /**
   * Extract name from function declarations and expressions
   */
  private extractFunctionName(
    node: TreeSitterParser.SyntaxNode,
    source: string
  ): string | undefined {
    return NodeUtils.extractIdentifier(node, source);
  }

  /**
   * Extract name from method definitions
   */
  private extractMethodName(
    node: TreeSitterParser.SyntaxNode,
    source: string
  ): string | undefined {
    return NodeUtils.extractIdentifier(node, source, [
      'property_identifier',
      'identifier',
    ]);
  }

  /**
   * Extract name from arrow functions (usually from parent context)
   */
  private extractArrowFunctionName(
    node: TreeSitterParser.SyntaxNode,
    source: string
  ): string | undefined {
    const parent = node.parent;

    // Arrow functions assigned to variables
    if (parent?.type === 'variable_declarator') {
      const pattern = parent.child(0);
      if (pattern) {
        if (pattern.type === 'identifier') {
          return NodeUtils.getNodeText(pattern, source);
        } else if (
          pattern.type === 'object_pattern' ||
          pattern.type === 'array_pattern'
        ) {
          // For destructuring, return the pattern text
          return NodeUtils.getNodeText(pattern, source);
        }
      }
    }

    // Arrow functions as object property values
    if (parent?.type === 'pair') {
      const key = parent.child(0);
      if (
        key &&
        ['property_identifier', 'identifier', 'string'].includes(key.type)
      ) {
        const name = NodeUtils.getNodeText(key, source);
        return NodeUtils.cleanString(name);
      }
    }

    return undefined;
  }
}
