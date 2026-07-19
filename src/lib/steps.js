// The story-building steps, in order. Each step asks the AI to brainstorm
// options for one ingredient of the story. `fallback` options keep the app
// usable in demo mode or when the API is unreachable.

export const STEPS = [
  {
    id: 'genre',
    label: 'Genre',
    title: 'What kind of story is this?',
    subtitle: 'Pick a genre — or invent your own blend.',
    guidance:
      'Offer a spread from beloved classics to unexpected genre blends. Each option should promise a distinct reading experience.',
    multi: false,
    fallback: [
      { title: 'Cozy Mystery', summary: 'A puzzle with warmth — low stakes, sharp minds, and a community full of secrets.' },
      { title: 'Epic Fantasy', summary: 'Sweeping realms, old magic, and a destiny that refuses to stay quiet.' },
      { title: 'Sci-Fi Noir', summary: 'Rain-slick megacities and hard questions — a detective story wearing a spacesuit.' },
      { title: 'Magical Realism', summary: 'The everyday world, tilted three degrees — miracles treated as furniture.' },
      { title: 'Survival Thriller', summary: 'One goal: live until morning. Nature, or something worse, has other plans.' },
      { title: 'Historical Romance', summary: 'Two hearts against the etiquette, politics, and corsetry of another era.' },
    ],
  },
  {
    id: 'theme',
    label: 'Theme',
    title: 'What is the story really about?',
    subtitle: 'The idea beating underneath the plot.',
    guidance:
      'Themes should be emotional undercurrents, not plot points — e.g. the cost of ambition, found family, what we owe the dead.',
    multi: false,
    fallback: [
      { title: 'Found Family', summary: 'The people who choose you matter more than the ones who were assigned.' },
      { title: 'The Cost of Ambition', summary: 'Every rung of the ladder is carved from something that used to matter.' },
      { title: 'Memory & Identity', summary: 'If your memories were edited, would the person reading this still be you?' },
      { title: 'Redemption', summary: 'No one is the worst thing they ever did — but proving it is the hard part.' },
      { title: 'Man vs. Machine', summary: 'The line between tool and mind is thinner than anyone wants to admit.' },
      { title: 'Coming Home', summary: 'You can return to the place, but the person who left never arrives.' },
    ],
  },
  {
    id: 'location',
    label: 'Location',
    title: 'Where does it happen?',
    subtitle: 'A setting is a character that never speaks.',
    guidance:
      'Settings should be vivid and specific enough to shape the plot — sensory, atmospheric, and full of story potential.',
    multi: false,
    fallback: [
      { title: 'Lighthouse at World’s End', summary: 'A crumbling beacon on a cliff where the maps politely give up.' },
      { title: 'Orbital Night Market', summary: 'A ring station bazaar where every stall sells something illegal somewhere.' },
      { title: 'Drowned Cathedral City', summary: 'Gondolas glide between bell towers; the old city sleeps below the waterline.' },
      { title: 'Desert Train Line', summary: 'A week-long railway crossing an ocean of dunes — no stops, no way off.' },
      { title: 'Appalachian Holler', summary: 'A fog-bound valley town the highway forgot, where folklore is load-bearing.' },
      { title: 'Library of Unwritten Books', summary: 'Endless shelves holding every story that was almost told.' },
    ],
  },
  {
    id: 'characters',
    label: 'Characters',
    title: 'Who is in the story?',
    subtitle: 'Pick up to three — heroes, foils, troublemakers.',
    guidance:
      'Characters should have a want, a flaw, and a hook in one breath. Mix protagonist material with foils and wildcard side characters.',
    multi: true,
    max: 3,
    fallback: [
      { title: 'The Retired Assassin Baker', summary: 'She traded knives for knead — but old clients keep visiting the shop.' },
      { title: 'A Cartographer Losing Sight', summary: 'He is mapping everything he loves before the world goes dark.' },
      { title: 'The Too-Curious Kid', summary: 'Twelve years old, immune to warnings, magnetically drawn to locked doors.' },
      { title: 'A Ghost with Amnesia', summary: 'Haunting a house for reasons even they can no longer remember.' },
      { title: 'The Disgraced Scholar', summary: 'Right about everything, believed by no one, running out of time to prove it.' },
      { title: 'A Loyal Dog Named Bishop', summary: 'Sees everything the humans miss. Judges accordingly.' },
    ],
  },
  {
    id: 'backstory',
    label: 'Backstory',
    title: 'What happened before page one?',
    subtitle: 'The wound the story keeps pressing on.',
    guidance:
      'Backstories are events that happened before the story begins and cast a long shadow over it — losses, betrayals, promises, secrets.',
    multi: false,
    fallback: [
      { title: 'The Broken Promise', summary: 'Years ago someone swore to come back. The story begins because they finally did.' },
      { title: 'The Fire Nobody Mentions', summary: 'Half the town burned a decade ago, and everyone agreed — silently — never to ask why.' },
      { title: 'An Inheritance with Strings', summary: 'The will left everything to the wrong person, along with one impossible condition.' },
      { title: 'The Vanished Expedition', summary: 'Twelve went in, one came out, and the survivor’s account has never added up.' },
      { title: 'A Debt to a Stranger', summary: 'Someone saved their life once and asked for nothing — until now.' },
      { title: 'The First Failure', summary: 'They had one chance to be great and blew it publicly. This is chance number two.' },
    ],
  },
  {
    id: 'twist',
    label: 'Twist',
    title: 'How should the rug get pulled?',
    subtitle: 'The turn the reader never sees coming.',
    guidance:
      'Twists should recontextualize the story, not just surprise — betrayals, hidden identities, inverted assumptions. Keep summaries spoiler-flavored but tantalizing.',
    multi: false,
    fallback: [
      { title: 'The Ally Was the Architect', summary: 'The most helpful person in the story built the whole problem on purpose.' },
      { title: 'It Already Happened', summary: 'The disaster everyone is racing to prevent occurred years ago — this is the cover-up.' },
      { title: 'The Narrator Is Lying', summary: 'One crucial detail has been wrong from the very first paragraph.' },
      { title: 'Two Villains, One Mask', summary: 'The antagonist turns out to be two people who have never met.' },
      { title: 'The Prize Is a Trap', summary: 'Getting exactly what they wanted is the worst thing that could happen.' },
      { title: 'The Dead Are Fine, Actually', summary: 'The person everyone mourns has been watching the whole time.' },
    ],
  },
  {
    id: 'details',
    label: 'Details',
    title: 'Any finishing touches?',
    subtitle: 'Pick up to three flourishes — tone, motifs, style.',
    guidance:
      'Details are flourishes: tone (bittersweet, darkly funny), motifs (recurring crows, unsent letters), stylistic touches (told through diary entries), or small vivid specifics.',
    multi: true,
    max: 3,
    fallback: [
      { title: 'Bittersweet Ending', summary: 'The goal is won, but something quietly precious is lost along the way.' },
      { title: 'Darkly Funny', summary: 'Gallows humor threaded through even the heaviest moments.' },
      { title: 'A Recurring Motif of Keys', summary: 'Keys appear at every turning point — some open doors, some lock them.' },
      { title: 'Weather with Opinions', summary: 'The sky mirrors the story’s mood with suspicious accuracy.' },
      { title: 'Chapter-Opening Letters', summary: 'Each section begins with a fragment of an unsent letter.' },
      { title: 'One Perfect Meal', summary: 'Somewhere in the story, a meal so well described the reader gets hungry.' },
    ],
  },
]

export const LENGTHS = [
  { id: 'short', label: 'Short tale', words: 600, blurb: '~600 words · a quick spark' },
  { id: 'medium', label: 'Full story', words: 1200, blurb: '~1,200 words · the classic bedtime length' },
  { id: 'long', label: 'Epic', words: 2500, blurb: '~2,500 words · settle in' },
]
