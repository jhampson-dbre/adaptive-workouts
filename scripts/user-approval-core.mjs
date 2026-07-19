const usage = 'Usage: approve|revoke --project-id PROJECT_ID (--email EMAIL | --uid UID)';

const readOption = (argv, index) => {
  const separatorIndex = argv[index].indexOf('=');
  if (separatorIndex !== -1) {
    return {
      name: argv[index].slice(0, separatorIndex),
      value: argv[index].slice(separatorIndex + 1),
      nextIndex: index,
    };
  }
  const name = argv[index];
  return { name, value: argv[index + 1], nextIndex: index + 1 };
};

export const parseApprovalCommand = argv => {
  const [action, ...options] = argv;
  if (!['approve', 'revoke'].includes(action)) throw new Error(usage);

  const values = {};
  for (let index = 0; index < options.length; index += 1) {
    const current = options[index];
    if (!current.startsWith('--')) throw new Error(usage);
    const { name, value, nextIndex } = readOption(options, index);
    if (!['--email', '--project-id', '--uid'].includes(name) || !value || value.startsWith('--') || values[name]) {
      throw new Error(usage);
    }
    values[name] = value;
    index = nextIndex;
  }

  if (!values['--project-id'] || Boolean(values['--email']) === Boolean(values['--uid'])) throw new Error(usage);
  return {
    action,
    projectId: values['--project-id'],
    selector: values['--email'] ? { email: values['--email'] } : { uid: values['--uid'] },
  };
};

const report = (logger, message) => logger(message);

export const manageUserApproval = async (argv, deps) => {
  let command;
  try {
    command = parseApprovalCommand(argv);
  } catch (error) {
    report(deps.error, error.message);
    return 1;
  }

  try {
    const credential = deps.applicationDefault();
    const app = deps.initializeApp({ credential, projectId: command.projectId });
    const auth = deps.getAuth(app);
    const user = command.selector.email
      ? await auth.getUserByEmail(command.selector.email)
      : await auth.getUser(command.selector.uid);
    const customClaims = user.customClaims ?? {};
    const isApprove = command.action === 'approve';
    const alreadyApproved = customClaims.approved === true;
    const hasApprovalClaim = Object.hasOwn(customClaims, 'approved');
    const shouldMutate = isApprove ? !alreadyApproved : hasApprovalClaim;

    if (shouldMutate) {
      const nextClaims = isApprove
        ? { ...customClaims, approved: true }
        : Object.fromEntries(Object.entries(customClaims).filter(([key]) => key !== 'approved'));
      await auth.setCustomUserClaims(user.uid, nextClaims);
    }

    const target = user.email ? `${user.uid} (${user.email})` : user.uid;
    report(deps.info, `${isApprove ? 'Approval' : 'Revocation'} for project ${command.projectId}, user ${target}: ${shouldMutate ? 'updated' : 'no change'}.`);
    return 0;
  } catch {
    report(deps.error, `Unable to ${command.action} user for project ${command.projectId}. Check local ADC, IAM permissions, and the selected user.`);
    return 1;
  }
};
