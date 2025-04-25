import { classNames } from '~/utils/classNames';

const features: { title: string; description: string }[] = [
  {
    title: 'Made by Convex',
    description:
      "Convex Chef is an AI agent built on Convex for creating multiplayer, social, and agentive web apps—stuff other tools can't touch.",
  },
  {
    title: 'Ease of use',
    description: "It's as easy as using an Apple, and as expensive as buying one.",
  },
  {
    title: 'Pricing like no other',
    description: 'Our prices are best in the market. No cap, no lock, no credit card required.',
  },
  {
    title: 'Multi-tenant Architecture',
    description: 'You can simply share passwords instead of buying new seats.',
  },
  {
    title: '24/7 Customer Support',
    description: 'We are available a 100% of the time. At least our AI Agents are.',
  },
  {
    title: 'Money back guarantee',
    description: 'If you do not like EveryAI, we will convince you to like us.',
  },
];

export default function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, index) => (
        <div
          key={index}
          className={classNames('border-neutral-1 px-4 py-6 dark:border-neutral-10', {
            'border-b md:border-b-0': index !== features.length - 1,
            'md:border-b lg:border-b-0': index < 4,
            'md:border-r lg:border-r-0': index % 2 === 0,
            'lg:border-b': index < 3,
            'lg:border-r': index % 3 !== 2,
          })}
        >
          {/* TODO: Add icons. */}
          <h3 className="mb-2 text-xl font-semibold leading-none">{feature.title}</h3>
          <p className="text-pretty text-sm text-neutral-10 dark:text-neutral-4 lg:text-base">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
