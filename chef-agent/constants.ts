export const SUGGESTIONS = [
  {
    title: 'Build a Slack clone',
    prompt:
      'Build an app similar to Slack. It should have a channels panel on the left with a button to create new channels. There should be a message pane on the right and a message posting box at the bottom. Each message should have a name and avatar next to it for the author of the message. There should be an "edit profile" tab that allows you to upload a profile photo to Convex storage and change your name. Make sure that the messages are the only thing that is scrollable. The message box and channel selector should stay fixed like the header. Make sure you scroll to the bottom when new messages are sent.',
  },
  {
    title: 'Build an Instagram clone',
    prompt:
      'Build an app similar to Instagram except it\'s a global shared image stream with all users. There should be a box you can drag and drop images into to upload them to Convex storage. When uploading an image it should get resized to a maximum of 800x800 and be cropped to a square. There should be a "Stream" tab for viewing the global stream and a "My Photos" tab for viewing your own images. You should be able to delete your own photos in the "My Photos" tab. You should be able to click a button to like each image in the "Stream" tab and it should show the like count for each image.',
  },
  {
    title: 'Build a Splitwise clone',
    prompt:
      'Build a group shared expenses app that has the following features:\n\n• Has users, groups, expenses, payments, and reimbursements\n• Represents members in a group via a table rather than an array\n• Users can create groups and invite other users to join\n• Group members can add expenses to a group, which get shared among all members in the group\n• Shows a list of members in the group and a list of expenses along with who paid them\n• Shows how much every member has been paid and reimbursed\n• Each member should be able to record a payment to another member, which adds to how much they have paid and adds to how much the recipient has been reimbursed\n• Members should record payments so that every member in the group has the same net balance',
  },
];

export const WORK_DIR_NAME = 'project';
export const WORK_DIR = `/home/${WORK_DIR_NAME}`;

export const PREWARM_PATHS = [`${WORK_DIR}/package.json`, `${WORK_DIR}/convex/schema.ts`, `${WORK_DIR}/src/App.tsx`];

// A list of files that we block the LLM from modifying
export const EXCLUDED_FILE_PATHS = ['convex/auth.ts', 'src/main.tsx', 'src/SignInForm.tsx', 'src/SignOutButton.tsx'];
