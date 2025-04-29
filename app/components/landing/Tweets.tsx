import { Tweet } from 'react-tweet';
// Array of tweet IDs showcasing positive feedback or testimonials
const tweets = [
  '1914609023728357854', // @PritamGhosh010
  '1914630453761319231', // @0xPaulius
  '1915023637935005854', // @developer_genie
  '1916442242580951202', // @DevBredda
  '1916442106593263677', // @igor9silva
  '1915756162286227602', // @eminimnim
  '1915006775415198080', // @ivzirs
  '1914744438628475039', // @eiiisd
  '1912598358876631389', // @HousewithBricks
  '1915141328826228855', // @TekStak
  '1916700085414404153', // @RealJPHJ
];

export default function Tweets() {
  return (
    <div className="mt-0 columns-1 gap-4 p-4 md:columns-2 lg:columns-3 [&>div]:mb-4">
      {tweets.map((id) => (
        <div key={id} className="break-inside-avoid [&>div]:!mt-0">
          <Tweet id={id} />
        </div>
      ))}
    </div>
  );
}
