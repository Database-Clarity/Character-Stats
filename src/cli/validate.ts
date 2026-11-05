import { validateProject, reportIssues } from './io';
try {
    const { issues } = await validateProject();
    reportIssues(issues);
    const errors = issues.filter((i) => i.severity === 'error').length;
    console.log(
        'Validation: ' +
            errors +
            ' error(s), ' +
            issues.filter((i) => i.severity === 'warning').length +
            ' warning(s)',
    );
    if (errors) {
        process.exitCode = 1;
    }
} catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
}
