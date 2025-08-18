/**
 * YAML utility functions for validation and formatting
 */

export interface YamlValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates YAML content for Kubernetes resources
 */
export function validateKubernetesYaml(yamlContent: string): YamlValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Basic YAML syntax validation
    const lines = yamlContent.split('\n');
    let hasApiVersion = false;
    let hasKind = false;
    let hasMetadata = false;
    let hasName = false;
    let hasSpec = false;
    let hasStatus = false;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        continue;
      }

      if (trimmedLine.startsWith('apiVersion:')) {
        hasApiVersion = true;
        // Check if apiVersion has a value
        const value = trimmedLine.substring('apiVersion:'.length).trim();
        if (!value) {
          errors.push(`Line ${lineNumber}: apiVersion is empty`);
        }
      }
      
      if (trimmedLine.startsWith('kind:')) {
        hasKind = true;
        // Check if kind has a value
        const value = trimmedLine.substring('kind:'.length).trim();
        if (!value) {
          errors.push(`Line ${lineNumber}: kind is empty`);
        }
      }
      
      if (trimmedLine.startsWith('metadata:')) {
        hasMetadata = true;
      }
      
      if (trimmedLine.startsWith('name:')) {
        hasName = true;
        // Check if name has a value
        const value = trimmedLine.substring('name:'.length).trim();
        if (!value) {
          errors.push(`Line ${lineNumber}: name is empty`);
        }
      }
      
      if (trimmedLine.startsWith('spec:')) {
        hasSpec = true;
      }
      
      if (trimmedLine.startsWith('status:')) {
        hasStatus = true;
      }
    }

    // Check for required fields
    if (!hasApiVersion) {
      errors.push('Missing required field: apiVersion');
    }
    
    if (!hasKind) {
      errors.push('Missing required field: kind');
    }
    
    if (!hasMetadata) {
      errors.push('Missing required field: metadata');
    }
    
    if (!hasName) {
      errors.push('Missing required field: metadata.name');
    }
    
    // Check for recommended fields
    if (!hasSpec) {
      warnings.push('Missing spec section (may be required for this resource type)');
    }
    
    // Warn about status field in user-provided YAML
    if (hasStatus) {
      warnings.push('Status field detected - this is typically managed by Kubernetes and should not be modified');
    }

    // Check for other problematic fields
    const problematicFields = [
      'metadata.resourceVersion',
      'metadata.generation',
      'metadata.uid',
      'metadata.creationTimestamp',
      'metadata.managedFields',
      'metadata.generateName',
      'metadata.deletionGracePeriodSeconds',
      'spec.minReadySeconds',
      'spec.revisionHistoryLimit',
      'spec.progressDeadlineSeconds',
      'spec.selector.matchLabels',
      'spec.strategy.rollingUpdate',
      'spec.template.metadata.generateName',
      'spec.template.metadata.resourceVersion',
      'spec.template.metadata.generation',
      'spec.template.metadata.uid',
      'spec.template.metadata.creationTimestamp',
      'spec.template.metadata.managedFields'
    ];

    for (const field of problematicFields) {
      const fieldParts = field.split('.');
      const currentLevel = lines;
      let found = false;
      
      for (let i = 0; i < fieldParts.length; i++) {
        const part = fieldParts[i];
        for (const line of currentLevel) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith(`${part}:`)) {
            if (i === fieldParts.length - 1) {
              found = true;
              break;
            }
            // This is a simplified check - in a real implementation you'd need to track indentation levels
            break;
          }
        }
        if (found) break;
      }
      
      if (found) {
        warnings.push(`${field} detected - this field is typically managed by Kubernetes and may cause apply conflicts`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [`Invalid YAML syntax: ${error}`],
      warnings: []
    };
  }
}

/**
 * Formats YAML content with proper indentation
 */
export function formatYaml(yamlContent: string): string {
  try {
    // Parse and re-stringify to ensure proper formatting
    const lines = yamlContent.split('\n');
    const formattedLines: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        formattedLines.push('');
        continue;
      }
      
      // Preserve comments
      if (trimmedLine.startsWith('#')) {
        formattedLines.push(line);
        continue;
      }
      
      // Find the original indentation
      const match = line.match(/^(\s*)/);
      const originalIndent = match ? match[1] : '';
      
      // Reconstruct the line with proper indentation
      formattedLines.push(originalIndent + trimmedLine);
    }
    
    return formattedLines.join('\n');
  } catch (error) {
    // If formatting fails, return original content
    return yamlContent;
  }
}

/**
 * Extracts resource information from YAML content
 */
export function extractResourceInfo(yamlContent: string): {
  apiVersion?: string;
  kind?: string;
  name?: string;
  namespace?: string;
} {
  const result: {
    apiVersion?: string;
    kind?: string;
    name?: string;
    namespace?: string;
  } = {};

  try {
    const lines = yamlContent.split('\n');
    let inMetadata = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('apiVersion:')) {
        result.apiVersion = trimmedLine.substring('apiVersion:'.length).trim();
      }
      
      if (trimmedLine.startsWith('kind:')) {
        result.kind = trimmedLine.substring('kind:'.length).trim();
      }
      
      if (trimmedLine.startsWith('metadata:')) {
        inMetadata = true;
      }
      
      if (inMetadata && trimmedLine.startsWith('name:')) {
        result.name = trimmedLine.substring('name:'.length).trim();
      }
      
      if (inMetadata && trimmedLine.startsWith('namespace:')) {
        result.namespace = trimmedLine.substring('namespace:'.length).trim();
      }
      
      // Exit metadata section if we encounter a top-level field
      if (inMetadata && !trimmedLine.startsWith(' ') && !trimmedLine.startsWith('\t') && trimmedLine !== '') {
        inMetadata = false;
      }
    }
  } catch (error) {
    // If extraction fails, return empty result
  }

  return result;
}

/**
 * Checks if YAML content has been modified from original
 */
export function hasYamlChanges(original: string, current: string): boolean {
  const normalize = (yaml: string) => yaml.trim().replace(/\r\n/g, '\n');
  return normalize(original) !== normalize(current);
}

/**
 * Cleans YAML content by removing fields that should not be included in patches
 */
export function cleanYamlForPatch(yamlContent: string): string {
  try {
    const lines = yamlContent.split('\n');
    const cleanedLines: string[] = [];
    let skipUntilLevel = -1;
    let currentIndentLevel = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        cleanedLines.push(line);
        continue;
      }

      // Calculate current indentation level
      const match = line.match(/^(\s*)/);
      const indent = match ? match[1] : '';
      currentIndentLevel = Math.floor(indent.length / 2); // Assuming 2 spaces per level

      // Check if we should skip this line
      if (skipUntilLevel >= 0) {
        if (currentIndentLevel <= skipUntilLevel) {
          skipUntilLevel = -1; // Stop skipping
        } else {
          continue; // Skip this line
        }
      }

      // Check for fields to remove
      const fieldsToRemove = [
        'status:',
        'resourceVersion:',
        'generation:',
        'uid:',
        'creationTimestamp:',
        'managedFields:',
        'finalizers:',
        'ownerReferences:',
        'generateName:',
        'deletionGracePeriodSeconds:',
        'minReadySeconds:',
        'revisionHistoryLimit:',
        'progressDeadlineSeconds:',
        'matchLabels:',
        'rollingUpdate:'
      ];

      let shouldSkip = false;
      for (const field of fieldsToRemove) {
        if (trimmedLine.startsWith(field)) {
          shouldSkip = true;
          skipUntilLevel = currentIndentLevel;
          break;
        }
      }

      if (!shouldSkip) {
        cleanedLines.push(line);
      }
    }

    return cleanedLines.join('\n');
  } catch (error) {
    // If cleaning fails, return original content
    return yamlContent;
  }
}
