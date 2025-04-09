import { json, type ActionFunctionArgs } from '@vercel/remix';

export async function loader(args: ActionFunctionArgs) {
  if (new URL(args.request.url).searchParams.get('throw')) {
    anotherFunction();
    return json({ foo: 'bar' });
  }
  return json({ foo: 'bar' });
}

function anotherFunction() {
  console.log('about to throw an error...');
  throw new Error('This is a test error');
}
