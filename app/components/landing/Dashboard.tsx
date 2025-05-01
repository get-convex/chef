import { useState } from 'react';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { classNames } from '~/utils/classNames';

interface DashboardFeature {
  title: string;
  description: string;
  imageUrl: string;
}

const dashboardFeatures: DashboardFeature[] = [
  {
    title: 'Access Your App Data',
    description:
      'The data page lets you view and manage all your tables and documents. Select a table to create, view, update, or delete documents directly inside Chef.',
    imageUrl: '/landing/data.png',
  },
  {
    title: 'Review Your App Logs',
    description:
      'The logs page is a realtime view of all activity that occurs within your Convex Chef App. The logs page provides a short history of recent function logs, and will display new logs as they are generated.',
    imageUrl: '/landing/logs.png',
  },
  {
    title: 'Add or Change Environment Variables',
    description:
      "Environment variables are key-value pairs that are useful for storing values you wouldn't want to put in code or in a table, such as an API key. You can set environment variables in Convex Chef through the dashboard.",
    imageUrl: '/landing/variables.png',
  },
  {
    title: 'Schedule Functions and Cron Jobs',
    description:
      'The schedules page displays all scheduled functions and cron jobs in your Chef app. Use the tabs at the top to switch between scheduled functions and cron jobs.',
    imageUrl: '/landing/schedule.png',
  },
];

export default function Dashboard() {
  const [activeFeature, setActiveFeature] = useState(0);

  const toggleFeature = (index: number) => {
    setActiveFeature(index);
  };

  return (
    <div className="flex flex-col items-center rounded-xl border border-neutral-1 bg-[#F7F3F1] p-4 dark:border-neutral-10 dark:bg-neutral-11 xl:p-6">
      <h2 className="my-2 text-balance text-center text-2xl font-bold leading-none tracking-tight lg:text-3xl">
        Convex Dashboard
      </h2>
      <div className="mb-8 max-w-prose text-balance text-center leading-normal text-neutral-9 dark:text-neutral-2">
        Chef embeds Convex&rsquo;s full dashboard into the builder, so you can manage real-time data, logs, and
        environment variables without leaving the interface.
      </div>
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="w-full xl:max-w-96">
          <div className="flex flex-col divide-y divide-neutral-2 dark:divide-neutral-9">
            {dashboardFeatures.map((feature, index) => (
              <div key={feature.title}>
                <button
                  onClick={() => toggleFeature(index)}
                  className="flex w-full items-center justify-between py-4 text-left"
                >
                  <span className={activeFeature === index ? 'font-bold' : 'font-medium'}>{feature.title}</span>
                  <ChevronRightIcon
                    className={classNames(
                      'size-6 text-neutral-8 transition-transform duration-200 dark:text-neutral-3',
                      { 'rotate-90': activeFeature === index },
                    )}
                  />
                </button>
                <div
                  className={classNames(
                    'grid transition-all duration-200',
                    activeFeature === index ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="pb-4">
                      <p className="max-w-prose text-sm text-neutral-8 dark:text-neutral-3">{feature.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden rounded-xl border bg-white p-0.5 sm:block">
          <img
            src={dashboardFeatures[activeFeature].imageUrl}
            alt={`${dashboardFeatures[activeFeature].title} screenshot`}
            width={2172}
            height={1200}
          />
        </div>
      </div>
    </div>
  );
}
