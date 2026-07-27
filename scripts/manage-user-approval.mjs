import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { pathToFileURL } from 'node:url';

import { manageUserApproval } from './user-approval-core.mjs';

const productionDeps = {
  applicationDefault,
  error: message => console.error(message),
  getAuth,
  info: message => console.log(message),
  initializeApp,
};

export const main = (argv, deps = productionDeps) => manageUserApproval(argv, deps);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await main(process.argv.slice(2));
  if (exitCode !== 0) process.exitCode = exitCode;
}
