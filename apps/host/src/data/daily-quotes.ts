/** Curated English quotes with Chinese translations for the header's daily line. */
export interface DailyQuote {
  en: string;
  zh: string;
}

export const DAILY_QUOTES: DailyQuote[] = [
  { en: 'The journey of a thousand miles begins with a single step.', zh: '千里之行，始于足下。' },
  { en: 'What you do every day matters more than what you do once in a while.', zh: '每天做的事，比偶尔做的事更重要。' },
  { en: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', zh: '我们反复做的事情造就了我们。优秀不是一种行为，而是一种习惯。' },
  { en: 'The best time to plant a tree was twenty years ago. The second best time is now.', zh: '种一棵树最好的时间是二十年前，其次是现在。' },
  { en: 'It does not matter how slowly you go as long as you do not stop.', zh: '只要不停下脚步，走得多慢都没有关系。' },
  { en: 'The only way to do great work is to love what you do.', zh: '成就伟大工作的唯一途径，是热爱你所做的事。' },
  { en: 'Stay hungry, stay foolish.', zh: '求知若饥，虚心若愚。' },
  { en: 'Life is what happens to you while you are busy making other plans.', zh: '生活就是在你忙于制定其他计划时发生的事情。' },
  { en: 'Not everything that is faced can be changed, but nothing can be changed until it is faced.', zh: '并非所有面对的事都能改变，但不去面对，什么都改变不了。' },
  { en: 'A year from now you may wish you had started today.', zh: '一年后，你可能会希望今天就已经开始。' },
  { en: 'Small deeds done are better than great deeds planned.', zh: '完成小事胜过计划大事。' },
  { en: 'The expert in anything was once a beginner.', zh: '任何领域的专家，都曾经是初学者。' },
  { en: 'You do not have to be great to start, but you have to start to be great.', zh: '你不必等到优秀了才开始，但你必须开始才会变得优秀。' },
  { en: 'Well begun is half done.', zh: '良好的开端是成功的一半。' },
  { en: 'Lost time is never found again.', zh: '光阴一去不复返。' },
  { en: 'The secret of getting ahead is getting started.', zh: '领先的秘诀就是开始行动。' },
  { en: 'Action is the foundational key to all success.', zh: '行动是一切成功的基础。' },
  { en: 'Where there is a will, there is a way.', zh: '有志者，事竟成。' },
  { en: 'Genius is one percent inspiration and ninety-nine percent perspiration.', zh: '天才是百分之一的灵感加上百分之九十九的汗水。' },
  { en: 'I have not failed. I have just found ten thousand ways that will not work.', zh: '我没有失败，我只是发现了一万种行不通的方法。' },
  { en: 'Everything should be made as simple as possible, but not simpler.', zh: '凡事都应尽可能简单，但不能过于简单。' },
  { en: 'Simplicity is the ultimate sophistication.', zh: '简约是极致的精妙。' },
  { en: 'Talk is cheap. Show me the code.', zh: '空谈无益，给我看你的代码。' },
  { en: 'First, solve the problem. Then, write the code.', zh: '先解决问题，再写代码。' },
  { en: 'Code is like humor. When you have to explain it, it is bad.', zh: '代码如幽默，需要解释就不好笑了。' },
  { en: 'Premature optimization is the root of all evil.', zh: '过早优化是万恶之源。' },
  { en: 'Make it work, make it right, make it fast.', zh: '先让它能跑，再让它正确，最后让它快。' },
  { en: 'The most effective way to do it, is to do it.', zh: '做事最有效的方式，就是去做。' },
  { en: 'Yesterday is history, tomorrow is a mystery, but today is a gift.', zh: '昨天已成历史，明天仍是谜团，而今天是馈赠。' },
  { en: 'How we spend our days is, of course, how we spend our lives.', zh: '我们如何度过每一天，自然就如何度过一生。' },
  { en: 'Energy and persistence conquer all things.', zh: '能量加毅力可以征服一切。' },
  { en: 'It always seems impossible until it is done.', zh: '在完成之前，一切看起来都不可能。' },
  { en: 'Do what you can, with what you have, where you are.', zh: '在你所在之处，用你所有之物，做你所能之事。' },
  { en: 'The mind is not a vessel to be filled, but a fire to be kindled.', zh: '头脑不是要填充的容器，而是要点燃的火把。' },
  { en: 'Learning never exhausts the mind.', zh: '学习永远不会耗尽心智。' },
];

/** Day-of-year (1-366) drives a deterministic rotation: same quote all day, no state, no API. */
export function quoteForDate(date: Date): DailyQuote {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]!;
}
