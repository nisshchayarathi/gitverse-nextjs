/**
 * Example usage of the Good First Issue Generator
 * 
 * This file demonstrates how to use the Good First Issue Generator
 * in different scenarios and contexts.
 */

import { generateGoodFirstIssues, getIssuesByDifficulty, getGeneratorStats } from '@/services/issueGeneratorService';
import { RepositoryMetadata } from '@/types/firstPRSimulator';

// Example 1: Basic Usage - Generate all issues
export const example1_basicUsage = (repository: RepositoryMetadata) => {
  const issues = generateGoodFirstIssues(repository);
  
  console.log(`Generated ${issues.length} good first issues`);
  
  // Display summary
  issues.forEach((issue) => {
    console.log(`- [${issue.difficulty}] ${issue.title}`);
    console.log(`  Effort: ${issue.estimatedEffort} (${issue.estimatedHours}h)`);
    console.log(`  Affected files: ${issue.affectedFiles.length}`);
  });
};

// Example 2: Filtered by Difficulty
export const example2_filterByDifficulty = (repository: RepositoryMetadata) => {
  const issues = getIssuesByDifficulty(repository);
  
  // Get only beginner issues
  const beginnerIssues = issues.beginner;
  console.log(`Found ${beginnerIssues.length} beginner-friendly issues`);
  
  // Display beginner issues
  beginnerIssues.forEach((issue) => {
    console.log(`✓ ${issue.title}`);
  });
};

// Example 3: With Configuration
export const example3_withConfig = (repository: RepositoryMetadata) => {
  const issues = generateGoodFirstIssues(repository, {
    minConfidenceScore: 0.8,      // Higher confidence threshold
    maxIssuesPerCategory: 1,       // Limit to 1 issue per type
  });
  
  console.log(`Generated ${issues.length} high-confidence issues`);
};

// Example 4: Get Statistics
export const example4_statistics = (repository: RepositoryMetadata) => {
  const stats = getGeneratorStats(repository);
  
  console.log('Issue Generator Statistics:');
  console.log(`- Total Issues: ${stats.totalIssues}`);
  console.log(`- Total Files: ${stats.totalFiles}`);
  console.log(`- Average Effort: ${stats.averageEffort.toFixed(1)} hours`);
  console.log('\nBy Type:');
  Object.entries(stats.issuesByType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });
  console.log('\nBy Difficulty:');
  Object.entries(stats.issuesByDifficulty).forEach(([difficulty, count]) => {
    console.log(`  - ${difficulty}: ${count}`);
  });
};

// Example 5: Generate GitHub Issue Body
export const example5_githubIssueBody = (repository: RepositoryMetadata) => {
  const issues = generateGoodFirstIssues(repository);
  
  if (issues.length === 0) {
    console.log('No issues to generate');
    return;
  }
  
  const firstIssue = issues[0];
  
  // This is the body you can paste directly into GitHub
  console.log('=== GITHUB ISSUE TEMPLATE ===');
  console.log(`Title: ${firstIssue.title}`);
  console.log('\nBody:');
  console.log(firstIssue.body);
  console.log('\nLabels:');
  console.log(firstIssue.suggestedLabels.join(', '));
};

// Example 6: Custom Issue Processing
export const example6_customProcessing = (repository: RepositoryMetadata) => {
  const issues = generateGoodFirstIssues(repository);
  
  // Group issues by affected file
  const issuesByFile = new Map<string, typeof issues>();
  
  issues.forEach((issue) => {
    const primaryFile = issue.affectedFiles[0];
    if (primaryFile) {
      if (!issuesByFile.has(primaryFile)) {
        issuesByFile.set(primaryFile, []);
      }
      issuesByFile.get(primaryFile)!.push(issue);
    }
  });
  
  // Display results
  console.log('Issues grouped by primary affected file:');
  issuesByFile.forEach((issuesForFile, file) => {
    console.log(`\n${file}:`);
    issuesForFile.forEach((issue) => {
      console.log(`  - ${issue.title} (${issue.difficulty})`);
    });
  });
};

// Example 7: React Component Usage
export const example7_componentUsage = () => {
  // In your React component:
  return `
    import { GoodFirstIssueGenerator } from '@/components/repository/GoodFirstIssueGenerator';
    
    export function MyComponent() {
      const repositoryData = {
        id: '123',
        name: 'my-repo',
        files: [...],
        // ... other data
      };
      
      return (
        <GoodFirstIssueGenerator 
          repository={repositoryData}
          loading={false}
        />
      );
    }
  `;
};

// Example 8: Export Issues to JSON
export const example8_exportToJson = (repository: RepositoryMetadata) => {
  const issues = generateGoodFirstIssues(repository);
  
  const exportData = {
    repository: repository.name,
    generatedAt: new Date().toISOString(),
    totalIssues: issues.length,
    issues: issues.map(issue => ({
      id: issue.id,
      title: issue.title,
      difficulty: issue.difficulty,
      estimatedHours: issue.estimatedHours,
      affectedFiles: issue.affectedFiles,
      suggestedLabels: issue.suggestedLabels,
      acceptanceCriteria: issue.acceptanceCriteria,
      // Note: body contains full markdown, could be large
      bodyPreview: issue.body.substring(0, 200) + '...',
    })),
  };
  
  return JSON.stringify(exportData, null, 2);
};

// Example 9: Integration with API endpoint
export const example9_apiEndpoint = async (repositoryId: string) => {
  // This would be an API route handler
  try {
    // Fetch repository data
    const repository = await fetchRepositoryData(repositoryId);
    
    // Generate issues
    const issues = generateGoodFirstIssues(repository, {
      minConfidenceScore: 0.7,
      maxIssuesPerCategory: 2,
    });
    
    // Return response
    return {
      success: true,
      data: {
        issues,
        stats: getGeneratorStats(repository),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// Example 10: Automated Workflow
export const example10_automatedWorkflow = async (repository: RepositoryMetadata) => {
  // Step 1: Generate issues
  const issues = generateGoodFirstIssues(repository);
  
  if (issues.length === 0) {
    console.log('No issues to create');
    return;
  }
  
  // Step 2: Filter by difficulty for batch creation
  const beginnerIssues = issues.filter(i => i.difficulty === 'Beginner').slice(0, 3);
  
  // Step 3: Create issues on GitHub
  for (const issue of beginnerIssues) {
    console.log(`Creating issue: ${issue.title}`);
    
    // This would call GitHub API
    // await createGitHubIssue({
    //   title: issue.title,
    //   body: issue.body,
    //   labels: issue.suggestedLabels,
    // });
    
    console.log('✓ Created');
  }
  
  console.log(`\nSuccessfully created ${beginnerIssues.length} issues`);
};

// Dummy function for example
const fetchRepositoryData = async (id: string): Promise<RepositoryMetadata> => {
  // Implementation would fetch actual data
  throw new Error('Not implemented');
};
