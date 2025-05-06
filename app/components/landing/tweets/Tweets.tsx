import type { Tweet } from './TweetCard';
import TweetCard from './TweetCard';
import HorizontalCarousel from './HorizontalCarousel';

const tweets: Tweet[] = [
  {
    author: 'Pritam Ghosh',
    handle: 'PritamGhosh010',
    text: 'I believe that the Chef from @convex_dev is currently the best option. Its backend integration makes it more usable than V0, Boult, and others.',
    link: 'https://twitter.com/PritamGhosh010/status/1914609023728357854',
  },
  {
    author: 'Paulius 🏴‍☠️',
    handle: '0xPaulius',
    text: 'used to waste 6-8 hrs on bolt/cursor just adding auth + supabase only to give up...\n\nconvex just does it all in seconds? wtf',
    link: 'https://twitter.com/0xPaulius/status/1914630453761319231',
  },
  {
    author: 'Genie',
    handle: 'developer_genie',
    text: '🚀 A miracle made in 30 minutes – the king of Vibe Coding is here!\nBuilt this fullstack app in just 20 minutes using chef convex.\nI cooked it solo. Vibe is real. 🍽️🔥\n👉 Check it out now: perceptive-squid-594.convex.app\n@convex_dev  #ConvexTopChef #MadeWithConvex',
    link: 'https://twitter.com/developer_genie/status/1915023637935005854',
  },
  {
    author: 'Dev Bredda | Launchifi',
    handle: 'DevBredda',
    text: "aye yo @convex_dev , what ever you did with Chef, it deserves a chef's kiss...\n\nit was able to one shot a web app for me that lovable and fire-trashcan couldnt do. \n\nHighly recommend you boys to use this one. \nconvex.dev/referral/DEVBR…",
    link: 'https://twitter.com/DevBredda/status/1916442242580951202',
  },
  {
    author: 'Igor Silva',
    handle: 'igor9silva',
    text: "if you haven't tried @convex_dev yet, please give it a try\n\nit's the perfect foundation for AI apps\nit's the greatest DX ever\nit's open source\n\nstart at chef.convex.dev",
    link: 'https://twitter.com/igor9silva/status/1916442106593263677',
  },
  {
    author: 'nim',
    handle: 'eminimnim',
    text: "Yes!! Migrated @Dessn_ai to @convex_dev few months ago and it's been so great. Building agentic experiences (with resumability etc) with convex is so easy!",
    link: 'https://twitter.com/eminimnim/status/1915756162286227602',
  },
  {
    author: 'Sam Shah',
    handle: 'ivzirs',
    text: "This is definitely the best coding agent I've come across. \n\nTalked to a client yesterday about using it to ship a new lead-gen tool daily! 🚀\n\nIt's that good!",
    link: 'https://twitter.com/ivzirs/status/1915006775415198080',
  },
  {
    author: 'Ellis Donovan',
    handle: 'eiiisd',
    text: 'chef by @convex_dev is absolutely banging',
    link: 'https://twitter.com/eiiisd/status/1914744438628475039',
  },
  {
    author: 'Ben House',
    handle: 'HousewithBricks',
    text: "Honestly if your not using @convex_dev for your backend idk what your doing tbh. The best BAAS product and not even close. Works super seamlessly with vibe coding, handles all the complexity. Don't believe me check out their new chef product or just listen to @theo",
    link: 'https://twitter.com/HousewithBricks/status/1912598358876631389',
  },
  {
    author: 'Gary Mellerick',
    handle: 'TekStak',
    text: "I can finally add AI to my app ideas without having a heart attach that I'm exposing my API keys 🔑  Thank God for @convex_dev ",
    link: 'https://twitter.com/TekStak/status/1915141328826228855',
  },
  {
    author: 'John Paul 📸',
    handle: 'RealJPHJ',
    text: 'Been testing @convex_dev Chef and have been Enjoying it!\n\nBeen building out a little Travel app! diligent-gnu-670.convex.app',
    link: 'https://twitter.com/RealJPHJ/status/1916700085414404153',
  },
];

export default function Tweets() {
  return (
    <div className="relative flex w-full flex-col gap-6">
      {/* Carousel */}
      <HorizontalCarousel tweets={tweets} />
      {/* Grid */}
      <div className="mt-0 hidden columns-3 gap-6 lg:block">
        {tweets.map((tweet) => (
          <TweetCard tweet={tweet} key={tweet.link} className="mb-6 break-inside-avoid" />
        ))}
      </div>
    </div>
  );
}
