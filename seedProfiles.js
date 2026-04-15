/**
 * AniGuess Seed Script
 * --------------------
 * Paste the entire contents of this file into the browser DevTools console
 * while the app is running. It merges data safely — re-running will not
 * create duplicates.
 *
 * HOW TO USE:
 *  1. Run `npm run dev` and open the app in your browser.
 *  2. Press F12 to open DevTools and go to the Console tab.
 *  3. Paste this entire file and press Enter.
 *  4. Refresh the page — all profiles will be populated.
 */

(function () {
  const PROFILES_KEY = 'aniguess_profiles';
  let _id = 1;
  const uid = () => 'seed_' + String(_id++).padStart(4, '0');

  const char = (name, gender, role, hairColor, ability, _genre) => ({
    id: uid(), name, gender, role, hairColor, ability, genre: _genre, imageUrl: '',
  });

  // ─── ANIME DEFINITIONS ───────────────────────────────────────────────────────
  // Each entry: [title, genre, [...characters]]

  const ANIME = {

    // ── SHARED (all 4 players) ────────────────────────────────────────────────

    moreThanMarried: ['More Than a Married Couple, But Not Lovers', 'Romance', [
      char('Jirou Yakuin',    'Male',   'Protagonist', 'Brown',  'Pretends to be married with Akari for class credit',     'Romance'),
      char('Akari Watanabe',  'Female', 'Protagonist', 'Orange', 'Pretends to be married with Jirou for class credit',     'Romance'),
      char('Minami Tenjin',   'Female', 'Supporting',  'Dark Brown', 'Jirou\'s actual crush who is paired with Aoshima',   'Romance'),
      char('Shinji Aoshima',  'Male',   'Supporting',  'Blue',   'Akari\'s actual crush who is paired with Minami',        'Romance'),
    ]],

    quintuplets: ['The Quintessential Quintuplets', 'Romance', [
      char('Fuutarou Uesugi', 'Male',   'Protagonist', 'Black',  'Genius tutor hired for the five Nakano sisters',         'Romance'),
      char('Ichika Nakano',   'Female', 'Supporting',  'Brown',  'Oldest quintuplet; aspiring actress',                    'Romance'),
      char('Nino Nakano',     'Female', 'Supporting',  'Brown',  'Second quintuplet; stubborn and protective of sisters',  'Romance'),
      char('Miku Nakano',     'Female', 'Supporting',  'Brown',  'Third quintuplet; history lover who wears headphones',   'Romance'),
      char('Yotsuba Nakano',  'Female', 'Supporting',  'Brown',  'Fourth quintuplet; cheerful athlete with a hair bow',    'Romance'),
      char('Itsuki Nakano',   'Female', 'Supporting',  'Brown',  'Fifth quintuplet; aspires to be a teacher like her mother', 'Romance'),
      char('Raiha Uesugi',    'Female', 'Supporting',  'Black',  'Fuutarou\'s kind younger sister',                        'Romance'),
      char('Maruo Nakano',    'Male',   'Supporting',  'Brown',  'Father of the quintuplets; strict and calculating',      'Romance'),
    ]],

    jjk: ['Jujutsu Kaisen', 'Action', [
      char('Yuji Itadori',       'Male',   'Protagonist', 'Pink',       'Superhuman strength and Sukuna\'s vessel',                  'Action'),
      char('Megumi Fushiguro',   'Male',   'Supporting',  'Black',      'Ten Shadows Technique; summons shikigami',                  'Action'),
      char('Nobara Kugisaki',    'Female', 'Supporting',  'Auburn',     'Straw Doll Technique using nails and a hammer',             'Action'),
      char('Satoru Gojo',        'Male',   'Supporting',  'White',      'Infinity and Six Eyes; arguably the strongest sorcerer',    'Action'),
      char('Ryomen Sukuna',      'Male',   'Antagonist',  'Pink',       'Dismantle and Cleave cursed techniques; King of Curses',    'Action'),
      char('Kento Nanami',       'Male',   'Supporting',  'Blonde',     'Ratio Technique that forces a weak point on any target',    'Action'),
      char('Aoi Todo',           'Male',   'Supporting',  'Black',      'Boogie Woogie swaps positions of anything with a clap',     'Action'),
      char('Junpei Yoshino',     'Male',   'Supporting',  'Brown',      'Moon Dregs shikigami; tragically manipulated by Mahito',    'Action'),
      char('Suguru Geto',        'Male',   'Antagonist',  'Black',      'Cursed Spirit Manipulation; collects and releases curses',  'Action'),
      char('Toge Inumaki',       'Male',   'Supporting',  'Silver',     'Cursed Speech; commands become reality when he speaks',     'Action'),
      char('Panda',              'Other',  'Supporting',  'Black',      'Superhuman strength; actually a mutated cursed corpse',     'Action'),
      char('Maki Zenin',         'Female', 'Supporting',  'Black',      'Weapons mastery compensating for near-zero cursed energy',  'Action'),
      char('Mahito',             'Other',  'Antagonist',  'Gray',       'Idle Transfiguration reshapes the shape of souls',         'Action'),
      char('Yuta Okkotsu',       'Male',   'Protagonist', 'Black',      'Enormous cursed energy reserves; bonded with Rika',        'Action'),
      char('Hanami',             'Other',  'Antagonist',  'None',       'Plant manipulation; a special-grade cursed spirit',        'Action'),
      char('Jogo',               'Other',  'Antagonist',  'None',       'Disaster Flames; volcano-headed special-grade curse',      'Action'),
      char('Choso',              'Male',   'Antagonist',  'Black',      'Bloodline Techniques using his own blood as a weapon',     'Action'),
      char('Naoya Zenin',        'Male',   'Antagonist',  'Blonde',     'Projection Sorcery; frames motion at 24 fps',              'Action'),
      char('Masamichi Yaga',     'Male',   'Supporting',  'Gray',       'Creates and animates cursed corpse puppets',               'Action'),
      char('Uraume',             'Other',  'Antagonist',  'White',      'Ice techniques; loyal to Sukuna across centuries',         'Action'),
    ]],

    alya: ['Alya Sometimes Hides Her Feelings In Russian', 'Romance', [
      char('Masachika Kuze',             'Male',   'Protagonist', 'Black',  'Student council member hiding a troubled past',          'Romance'),
      char('Alisa Mikhailovna Kujou',    'Female', 'Protagonist', 'Silver', 'Half-Russian top student who mutters feelings in Russian','Romance'),
      char('Yuki Suou',                  'Female', 'Supporting',  'Blonde', 'Student council president and Masachika\'s childhood friend','Romance'),
      char('Nonoa Suou',                 'Female', 'Supporting',  'Blonde', 'Yuki\'s mischievous younger sister',                    'Romance'),
      char('Touya Saitou',               'Male',   'Supporting',  'Brown',  'Masachika\'s easygoing best friend',                    'Romance'),
      char('Maria Mikhailovna Kujou',    'Female', 'Supporting',  'Silver', 'Alya\'s flirtatious older sister',                      'Romance'),
    ]],

    chainsawMan: ['Chainsaw Man', 'Action', [
      char('Denji',            'Male',   'Protagonist', 'Blonde', 'Merges with Pochita to become the Chainsaw Devil hybrid',  'Action'),
      char('Power',            'Female', 'Supporting',  'Pink',   'Blood Manipulation as a blood fiend; impulsive and feral', 'Action'),
      char('Makima',           'Female', 'Antagonist',  'Brown',  'Control Devil who dominates anything she deems lesser',    'Action'),
      char('Aki Hayakawa',     'Male',   'Supporting',  'Black',  'Contracts with the Future and Fox Devils; stoic hunter',   'Action'),
      char('Himeno',           'Female', 'Supporting',  'Black',  'Ghost Devil contract; Aki\'s senior partner (eyepatch)',   'Action'),
      char('Kishibe',          'Male',   'Supporting',  'Gray',   'Division 1\'s strongest hunter; trains Denji and Power',  'Action'),
      char('Kobeni Higashiyama','Female','Supporting',  'Brown',  'Unknown devil contract; terrified but surprisingly lethal','Action'),
      char('Reze',             'Female', 'Antagonist',  'Blue',   'Bomb Devil hybrid sent to assassinate Denji',              'Action'),
      char('Quanxi',           'Female', 'Antagonist',  'Blonde', 'Crossbow Fiend with multiple devil contracts; brutal',     'Action'),
      char('Angel Devil',      'Male',   'Supporting',  'Silver', 'Absorbs lifespan through touch; produces divine weapons',  'Action'),
      char('Katana Man',       'Male',   'Antagonist',  'Black',  'Katana Devil hybrid with retractable blade arms',          'Action'),
      char('Beam',             'Male',   'Supporting',  'Silver', 'Shark Fiend who can tunnel through surfaces rapidly',      'Action'),
    ]],

    // ── SHARED (Caden, Gavin, Gabe) ──────────────────────────────────────────

    bunnyGirl: ['Rascal Does Not Dream of Bunny Girl Senpai', 'Romance', [
      char('Sakuta Azusagawa', 'Male',   'Protagonist', 'Brown', 'Helps people suffering from Adolescence Syndrome',          'Romance'),
      char('Mai Sakurajima',   'Female', 'Protagonist', 'Black', 'Famous actress made invisible by Adolescence Syndrome',     'Romance'),
      char('Tomoe Koga',       'Female', 'Supporting',  'Brown', 'Trapped in a time loop by Adolescence Syndrome',           'Romance'),
      char('Rio Futaba',       'Female', 'Supporting',  'Purple','Splits into two selves due to Adolescence Syndrome',       'Romance'),
      char('Nodoka Toyohama',  'Female', 'Supporting',  'Blonde','Mai\'s half-sister; they swap bodies via Adolescence Syndrome','Romance'),
      char('Kaede Azusagawa', 'Female',  'Supporting',  'Black', 'Sakuta\'s sister; lost memories from Adolescence Syndrome','Romance'),
      char('Shouko Makinohara','Female', 'Supporting',  'Brown', 'Mysterious girl connected to Sakuta\'s past and future',   'Romance'),
      char('Kunimi',           'Male',   'Supporting',  'Brown', 'Sakuta\'s reliable friend from class',                     'Romance'),
    ]],

    akameGaKill: ['Akame Ga Kill!', 'Action', [
      char('Tatsumi',          'Male',   'Protagonist', 'Dark Brown','Wields Incursio, an armor-type Teigu',                 'Action'),
      char('Akame',            'Female', 'Protagonist', 'Black',    'Murasame blade kills with a single cut via its curse',  'Action'),
      char('Mine',             'Female', 'Supporting',  'Pink',     'Pumpkin gun Teigu grows stronger the more danger she is in','Action'),
      char('Bulat',            'Male',   'Supporting',  'Blue',     'Original Incursio user; flamboyant and powerful',        'Action'),
      char('Lubbock',          'Male',   'Supporting',  'Green',    'Cross Tail wire Teigu; laid-back but deadly',           'Action'),
      char('Leone',            'Female', 'Supporting',  'Blonde',   'Lionelle Teigu grants beast-like transformation',        'Action'),
      char('Sheele',           'Female', 'Supporting',  'Purple',   'Extase scissors Teigu can cut through anything',        'Action'),
      char('Chelsea',          'Female', 'Supporting',  'Orange',   'Gaea Foundation Teigu allows perfect physical disguise', 'Action'),
      char('Najenda',          'Female', 'Supporting',  'Silver',   'Night Raid leader with a mechanical arm',               'Action'),
      char('Susanoo',          'Male',   'Supporting',  'Dark Brown','Living Teigu with superhuman combat abilities',         'Action'),
      char('Esdeath',          'Female', 'Antagonist',  'Silver',   'Ice manipulation; the Empire\'s most powerful general', 'Action'),
      char('Seryu Ubiquitous', 'Female', 'Antagonist',  'Brown',    'Coro living Teigu embedded in her own body; deranged',  'Action'),
      char('Dr. Stylish',      'Male',   'Antagonist',  'White',    'Creates and enhances soldiers with forbidden science',   'Action'),
      char('Wave',             'Male',   'Supporting',  'Dark Brown','Grand Chariot armor Teigu; reluctant antagonist',       'Action'),
      char('Kurome',           'Female', 'Antagonist',  'Black',    'Yatsufusa reanimates corpses as puppets; Akame\'s sister','Action'),
      char('Run',              'Male',   'Supporting',  'Blonde',   'Mastema feather projectile Teigu; double agent',        'Action'),
      char('Budo',             'Male',   'Antagonist',  'Gray',     'Adramelech lightning Teigu; imperial guard general',    'Action'),
      char('Honest',           'Male',   'Antagonist',  'Gray',     'Corrupt Prime Minister manipulating the young Emperor', 'Action'),
      char('Zanku the Beheader','Male',  'Antagonist',  'Silver',   'Spectator Teigu reads minds; sadistic serial killer',   'Action'),
    ]],

    mushokuTensei: ['Mushoku Tensei', 'Isekai', [
      char('Rudeus Greyrat',    'Male',   'Protagonist', 'Red',    'Reincarnated genius with extraordinary magical talent',   'Isekai'),
      char('Sylphiette',        'Female', 'Supporting',  'Green',  'Wind magic prodigy; becomes Rudeus\'s wife',             'Isekai'),
      char('Roxy Migurdia',     'Female', 'Supporting',  'Blue',   'Migurd water mage; Rudeus\'s first teacher',             'Isekai'),
      char('Eris Boreas Greyrat','Female','Supporting',  'Red',    'Fierce sword prodigy noble; Rudeus\'s second wife',      'Isekai'),
      char('Paul Greyrat',      'Male',   'Supporting',  'Brown',  'Rudeus\'s father; skilled in multiple sword styles',     'Isekai'),
      char('Zenith Greyrat',    'Female', 'Supporting',  'Blonde', 'Rudeus\'s mother; healing mage trapped in a mana crystal','Isekai'),
      char('Ghislaine Dedoldia', 'Female','Supporting',  'Brown',  'Beast-eared Sword King; serves as Eris\'s bodyguard',   'Isekai'),
      char('Ruijerd Superdia',  'Male',   'Supporting',  'Green',  'Superd warrior who protects children; feared everywhere','Isekai'),
      char('Orsted',            'Male',   'Supporting',  'Silver', 'Dragon God cursed to be feared by everyone he meets',    'Isekai'),
      char('Norn Greyrat',      'Female', 'Supporting',  'Brown',  'Rudeus\'s younger sister; shy and stubborn',             'Isekai'),
      char('Aisha Greyrat',     'Female', 'Supporting',  'Black',  'Rudeus\'s diligent half-sister; manages the household',  'Isekai'),
      char('Lilia',             'Female', 'Supporting',  'Silver', 'Greyrat family maid; Aisha\'s mother',                   'Isekai'),
      char('Luke Notos Greyrat','Male',   'Supporting',  'Blonde', 'Noble escort assigned to Sylphiette',                   'Isekai'),
      char('Kishirika Kishirisu','Female','Supporting',  'Purple', 'Great Emperor of the Demon World; grants demon eyes',   'Isekai'),
    ]],

    angelBeats: ['Angel Beats!', 'Other', [
      char('Yuzuru Otonashi',      'Male',   'Protagonist', 'Brown',  'Amnesiac who helps souls find peace in the afterlife',  'Other'),
      char('Kanade Tachibana',     'Female', 'Supporting',  'Silver', 'Angel who administers the afterlife school; uses Harmonics','Other'),
      char('Yuri Nakamura',        'Female', 'Supporting',  'Purple', 'Leader of the Afterlife Battle Front against God',      'Other'),
      char('Hinata Hideki',        'Male',   'Supporting',  'Blue',   'Otonashi\'s cheerful and dependable best friend',       'Other'),
      char('Naoi Ayato',           'Male',   'Supporting',  'Brown',  'Former student council president who uses hypnosis',    'Other'),
      char('Iwasawa',              'Female', 'Supporting',  'Brown',  'Lead vocalist of Girls Dead Monster band',              'Other'),
      char('Yui',                  'Female', 'Supporting',  'Pink',   'Energetic GDM replacement vocalist with a bucket list', 'Other'),
      char('Noda',                 'Male',   'Supporting',  'Brown',  'Impulsive SSS member who wields a halberd',             'Other'),
      char('Shiina',               'Female', 'Supporting',  'Black',  'SSS member with ninja-like agility and reflexes',       'Other'),
      char('TK',                   'Male',   'Supporting',  'Blonde', 'Mysterious SSS member who only speaks in English phrases','Other'),
      char('Takamatsu',            'Male',   'Supporting',  'Brown',  'Intellectual SSS member with a secretly muscular body',  'Other'),
      char('Fujimaki',             'Male',   'Supporting',  'Brown',  'SSS member who carries a katana',                       'Other'),
    ]],

    shiunji: ['The Children of Shiunji Family', 'Romance', [
      char('Haruki Shiunji', 'Male',   'Protagonist', 'Black', 'Eldest son of the blended Shiunji family; responsible and caring', 'Romance'),
      char('Hana Shiunji',   'Female', 'Protagonist', 'Black', 'Eldest daughter who develops complicated feelings for Haruki',     'Romance'),
      char('Akito Shiunji',  'Male',   'Supporting',  'Black', 'Second son; carefree younger brother of Haruki',                  'Romance'),
      char('Koyuki Shiunji', 'Female', 'Supporting',  'Black', 'Younger sister with a gentle personality',                        'Romance'),
    ]],

    fragrantFlower: ['The Fragrant Flower Blooms With Dignity', 'Romance', [
      char('Rintaro Tsumugi', 'Male',   'Protagonist', 'Black', 'Student from a rough school with a passion for flowers',    'Romance'),
      char('Kaoruko Waguri',  'Female', 'Protagonist', 'Brown', 'Refined student from a prestigious girls\' school',         'Romance'),
      char('Haruhi Koganei',  'Female', 'Supporting',  'Brown', 'Kaoruko\'s warm and encouraging best friend',               'Romance'),
      char('Tsubaki Kuze',    'Male',   'Supporting',  'Brown', 'Rintaro\'s reliable friend from Kikuou High',               'Romance'),
    ]],

    oshinoko: ['Oshi No Ko', 'Other', [
      char('Aquamarine Hoshino', 'Male',   'Protagonist', 'Black', 'Reincarnated doctor navigating the entertainment industry to find the truth about his mother\'s death', 'Other'),
      char('Ruby Hoshino',      'Female', 'Protagonist', 'Pink',  'Reincarnated girl who pursues her dream of becoming an idol', 'Other'),
      char('Ai Hoshino',        'Female', 'Supporting',  'Pink',  'Top idol who hid her twin children from the public',         'Other'),
      char('Kana Arima',        'Female', 'Supporting',  'Red',   'Former child actress with exceptional expressive talent',    'Other'),
      char('Akane Kurokawa',    'Female', 'Supporting',  'Brown', 'Method actress who immerses herself completely in roles',    'Other'),
      char('Mem-cho',           'Female', 'Supporting',  'Brown', 'Older member of B-Komachi who hides her age',               'Other'),
      char('Ichigo Saitou',     'Male',   'Supporting',  'Brown', 'Ai\'s devoted manager and head of Strawberry Productions',  'Other'),
      char('Miyako Saitou',     'Female', 'Supporting',  'Brown', 'Runs Strawberry Productions and raises Aqua and Ruby',      'Other'),
      char('Pieyon',            'Male',   'Supporting',  'Blonde','Content creator and choreographer who collaborates with Ruby','Other'),
    ]],

    // ── SHARED (Caden, Gavin, Liam) ──────────────────────────────────────────

    chivalry: ['Chivalry of a Failed Knight', 'Action', [
      char('Ikki Kurogane',     'Male',   'Protagonist', 'Black',  'Lowest-ranked Blazer who compensates with genius swordsmanship', 'Action'),
      char('Stella Vermillion', 'Female', 'Protagonist', 'Red',    'A-rank Blazer princess with immense magical power',              'Action'),
      char('Shizuku Kurogane',  'Female', 'Supporting',  'Black',  'Ikki\'s sister; water manipulation via her Device',             'Action'),
      char('Nagi Arisuin',      'Male',   'Supporting',  'Black',  'Dark matter manipulation; Stella\'s roommate and friend',       'Action'),
      char('Tohka Todo',        'Female', 'Supporting',  'Brown',  'Sword master and former Seven Stars champion',                  'Action'),
      char('Kuraudo Kurashiki', 'Male',   'Antagonist',  'Silver', 'Street-fighting sword user who targets Ikki',                   'Action'),
      char('Amane Shinomiya',   'Female', 'Supporting',  'Silver', 'Student council president who opposes Ikki initially',          'Action'),
      char('Kagami Kurogane',   'Male',   'Antagonist',  'Black',  'Ikki\'s father who stripped his son of all privileges',        'Action'),
    ]],

    blueLock: ['Blue Lock', 'Sports', [
      char('Yoichi Isagi',   'Male', 'Protagonist', 'Black',  'Spatial awareness lets him find the optimal shooting angle',    'Sports'),
      char('Meguru Bachira', 'Male', 'Supporting',  'Black',  'Dribbling monster guided by an imaginary monster inside him',   'Sports'),
      char('Rensuke Kunigami','Male','Supporting',  'Blonde', 'Physical powerhouse striker aiming to be a hero',              'Sports'),
      char('Hyoma Chigiri',  'Male', 'Supporting',  'Red',    'Fastest sprinter in Blue Lock with explosive acceleration',     'Sports'),
      char('Wataru Kuon',    'Male', 'Supporting',  'Brown',  'Tactical manipulator who exploits teammates for personal gain','Sports'),
      char('Gin Gagamaru',   'Male', 'Supporting',  'Black',  'Massive goalkeeper with exceptional reflexes',                  'Sports'),
      char('Jingo Raichi',   'Male', 'Supporting',  'Brown',  'Hot-blooded striker who relies on raw passion',                 'Sports'),
      char('Aoshi Niko',     'Male', 'Supporting',  'Silver', 'Copy ability striker who replicates others\' movements',        'Sports'),
      char('Shoei Barou',    'Male', 'Supporting',  'Brown',  'Self-declared king striker with absurd individual skill',       'Sports'),
      char('Seishiro Nagi',  'Male', 'Supporting',  'Silver', 'Trapping genius who controls any ball effortlessly',           'Sports'),
      char('Reo Mikage',     'Male', 'Supporting',  'Purple', 'Rich all-rounder who built himself around Nagi\'s talent',     'Sports'),
      char('Zantetsu Tsurugi','Male','Supporting',  'Black',  'Explosive speed dribbler obsessed with being the fastest',     'Sports'),
      char('Asahi Naruhaya', 'Male', 'Supporting',  'Brown',  'Team-oriented striker focused on passes and cooperation',      'Sports'),
      char('Rin Itoshi',     'Male', 'Supporting',  'Black',  'Genius striker with a perfect all-around game; Sae\'s brother','Sports'),
      char('Sae Itoshi',     'Male', 'Supporting',  'Silver', 'Top midfielder who plays for the Spanish national team',       'Sports'),
      char('Oliver Aiku',    'Male', 'Supporting',  'Black',  'National team defender with world-class physical ability',     'Sports'),
      char('Jinpachi Ego',   'Male', 'Supporting',  'Black',  'Blue Lock\'s eccentric and ruthless director',                 'Sports'),
      char('Anri Teieri',    'Female','Supporting', 'Brown',  'Blue Lock staff member who assists Ego',                       'Sports'),
    ]],

    charlotte: ['Charlotte', 'Other', [
      char('Yuu Otosaka',          'Male',   'Protagonist', 'Brown',  'Steals others\' abilities for five seconds via possession', 'Other'),
      char('Nao Tomori',           'Female', 'Supporting',  'Silver', 'Ability to turn invisible to one specific person at a time','Other'),
      char('Joujirou Takajou',     'Male',   'Supporting',  'Brown',  'Uncontrollable super speed that injures himself constantly', 'Other'),
      char('Ayumi Otosaka',        'Female', 'Supporting',  'Brown',  'Yuu\'s cheerful little sister with a Collapse ability',     'Other'),
      char('Shunsuke Otosaka',     'Male',   'Supporting',  'Brown',  'Time Leap ability; Yuu\'s older brother who works behind the scenes','Other'),
      char('Yusa Nishimori',       'Female', 'Supporting',  'Pink',   'Pop idol who is channeled by the spirit of her sister Misa', 'Other'),
      char('Misa Nishimori',       'Female', 'Supporting',  'Pink',   'Yusa\'s deceased sister who possesses her body and uses pyrokinesis','Other'),
    ]],

    // ── SHARED (Caden, Gavin) ─────────────────────────────────────────────────

    dxd: ['High School DxD', 'Action', [
      char('Issei Hyoudou',    'Male',   'Protagonist', 'Brown',  'Boosted Gear doubles power every 10 seconds; pervy dragon',   'Action'),
      char('Rias Gremory',     'Female', 'Protagonist', 'Red',    'Power of Destruction annihilates anything it touches',        'Action'),
      char('Akeno Himejima',   'Female', 'Supporting',  'Black',  'Holy Lightning magic; Issei\'s queen and fallen angel hybrid','Action'),
      char('Koneko Toujou',    'Female', 'Supporting',  'White',  'Senjutsu and Touki reinforce the body with life energy',      'Action'),
      char('Asia Argento',     'Female', 'Supporting',  'Blonde', 'Twilight Healing restores any wound; former sister',          'Action'),
      char('Xenovia Quarta',   'Female', 'Supporting',  'Blue',   'Wields Durandal and later Ex-Durandal, a holy sword',        'Action'),
      char('Irina Shidou',     'Female', 'Supporting',  'Brown',  'Childhood friend of Issei; wields holy swords as an Angel',  'Action'),
      char('Gasper Vladi',     'Male',   'Supporting',  'Blonde', 'Sacred Gear can stop time for anything his eyes can see',    'Action'),
      char('Yuuto Kiba',       'Male',   'Supporting',  'Blonde', 'Sword Birth creates Holy Demonic Swords from nothing',       'Action'),
      char('Ravel Phoenix',    'Female', 'Supporting',  'Blonde', 'Phoenix flame manipulation; later becomes Issei\'s manager', 'Action'),
      char('Rossweisse',       'Female', 'Supporting',  'Silver', 'Norse magic specialist; former Valkyrie',                    'Action'),
      char('Sirzechs Lucifer', 'Male',   'Supporting',  'Red',    'Rias\'s brother; his Power of Destruction can reduce anything to its base state','Action'),
      char('Grayfia Lucifuge', 'Female', 'Supporting',  'Silver', 'Sirzechs\'s queen and wife; an immensely powerful maid',     'Action'),
      char('Raiser Phoenix',   'Male',   'Antagonist',  'Blonde', 'Phoenix immortality regenerates any wound instantly',        'Action'),
      char('Vali Lucifer',     'Male',   'Antagonist',  'White',  'Divine Dividing halves an opponent\'s power every 10 seconds','Action'),
      char('Kokabiel',         'Male',   'Antagonist',  'Black',  'Powerful fallen angel leader who instigates the Three Factions conflict','Action'),
      char('Sairaorg Bael',    'Male',   'Supporting',  'Black',  'Pure physical Touki power with no demonic energy whatsoever', 'Action'),
      char('Freed Sellzen',    'Male',   'Antagonist',  'Blonde', 'Psychotic exorcist wielding holy swords for the wrong side',  'Action'),
      char('Cao Cao',          'Male',   'Antagonist',  'Brown',  'True Longinus spear; leader of the Hero Faction',            'Action'),
    ]],

    hsotd: ['High School of the Dead', 'Horror', [
      char('Takashi Komuro',   'Male',   'Protagonist', 'Brown',  'Natural leader who guides the group using a baseball bat',  'Horror'),
      char('Rei Miyamoto',     'Female', 'Protagonist', 'Brown',  'Spear and pole weapon fighter; Takashi\'s childhood friend','Horror'),
      char('Saeko Busujima',   'Female', 'Supporting',  'Purple', 'Kendo master who thrives in the chaos of the outbreak',     'Horror'),
      char('Saya Takagi',      'Female', 'Supporting',  'Pink',   'Brilliant tactician who analyzes undead behavior',          'Horror'),
      char('Kohta Hirano',     'Male',   'Supporting',  'Brown',  'Firearms expert and otaku who becomes the group\'s gunner', 'Horror'),
      char('Shizuka Marikawa', 'Female', 'Supporting',  'Blonde', 'School nurse who serves as the group\'s medic and driver',  'Horror'),
      char('Alice Maresato',   'Female', 'Supporting',  'Brown',  'Young child rescued and adopted by the group',              'Horror'),
      char('Souichiro Takagi', 'Male',   'Supporting',  'Gray',   'Saya\'s powerful father who leads a militant survivor group','Horror'),
      char('Yuriko Takagi',    'Female', 'Supporting',  'Blonde', 'Saya\'s calm and elegant mother; expert markswoman',        'Horror'),
    ]],

    sao: ['Sword Art Online', 'Action', [
      char('Kirito',          'Male',   'Protagonist', 'Black',  'Dual-wielding swordsman and the Black Swordsman of SAO',     'Action'),
      char('Asuna Yuuki',     'Female', 'Protagonist', 'Brown',  'Lightning Flash fencer; sub-leader of Knights of the Blood', 'Action'),
      char('Sinon',           'Female', 'Supporting',  'Blue',   'Elite sniper in GGO with a Hecate II anti-materiel rifle',   'Action'),
      char('Leafa',           'Female', 'Supporting',  'Blonde', 'Kirito\'s sister Suguha; sylph wind magic and kendo master', 'Action'),
      char('Yui',             'Female', 'Supporting',  'Black',  'AI navigation pixie who is Kirito and Asuna\'s daughter',    'Action'),
      char('Klein',           'Male',   'Supporting',  'Red',    'Kirito\'s first friend in SAO; samurai-style fighter',       'Action'),
      char('Agil',            'Male',   'Supporting',  'Black',  'Merchant and axe fighter who supports Kirito\'s group',      'Action'),
      char('Lisbeth',         'Female', 'Supporting',  'Pink',   'Top blacksmith who crafts Kirito\'s Dark Repulser',          'Action'),
      char('Silica',          'Female', 'Supporting',  'Brown',  'Beast tamer with a dragon familiar named Pina',              'Action'),
      char('Heathcliff',      'Male',   'Antagonist',  'Brown',  'SAO creator Kayaba Akihiko who trapped 10,000 players',      'Action'),
      char('Sugou Nobuyuki',  'Male',   'Antagonist',  'Blonde', 'ALO administrator and fairy king Oberon who abuses players', 'Action'),
      char('Alice Schuberg',  'Female', 'Supporting',  'Blonde', 'Integrity Knight with the Perfect Weapon Control art',      'Action'),
      char('Eugeo',           'Male',   'Supporting',  'Blue',   'Kirito\'s best friend in the Underworld; Blue Rose Sword',   'Action'),
      char('Administrator',   'Female', 'Antagonist',  'Silver', 'Quinella rules the Underworld as an immortal god-ruler',     'Action'),
      char('Bercouli',        'Male',   'Supporting',  'Silver', 'Captain of the Integrity Knights; Time Piercing Sword',      'Action'),
    ]],

    hundredGirlfriends: ['The 100 Girlfriends Who Really, Really, Really, Really, Really Love You', 'Romance', [
      char('Rentarou Aijou', 'Male',   'Protagonist', 'Brown',  'Has 100 destined soulmates; loves each girlfriend equally',  'Romance'),
      char('Hakari Hanazono','Female', 'Supporting',  'Pink',   'First girlfriend; loves Rentarou so intensely she could die','Romance'),
      char('Karane Inda',    'Female', 'Supporting',  'Orange', 'Second girlfriend; classic tsundere who hides her feelings', 'Romance'),
      char('Shizuka Yoshimoto','Female','Supporting', 'Black',  'Third girlfriend; extremely shy bookworm',                   'Romance'),
      char('Nano Eiai',      'Female', 'Supporting',  'White',  'Fourth girlfriend; speaks and thinks with machine precision','Romance'),
      char('Iku Yakuin',     'Female', 'Supporting',  'Brown',  'Fifth girlfriend; reliable older-sister type',               'Romance'),
      char('Mimimi Unabara', 'Female', 'Supporting',  'Brown',  'Sixth girlfriend; cheerful and energetic',                  'Romance'),
      char('Kusuri Yakuin',  'Female', 'Supporting',  'Pink',   'Seventh girlfriend; mad scientist who brews love potions',  'Romance'),
      char('Hahari Hanazono','Female', 'Supporting',  'Pink',   'Hakari\'s mother who also becomes one of Rentarou\'s girlfriends','Romance'),
      char('Chiyo Wahira',   'Female', 'Supporting',  'Brown',  'Girlfriend with a split personality depending on hairstyle','Romance'),
      char('Mei Seki',       'Female', 'Supporting',  'Brown',  'Quiet girlfriend with extreme social anxiety',               'Romance'),
    ]],

    demonSlayer: ['Demon Slayer', 'Action', [
      char('Tanjiro Kamado',  'Male',   'Protagonist', 'Black',  'Water and Sun Breathing swordsman seeking a cure for Nezuko','Action'),
      char('Nezuko Kamado',   'Female', 'Supporting',  'Black',  'Demon who fights alongside her brother using Blood Demon Art','Action'),
      char('Zenitsu Agatsuma','Male',   'Supporting',  'Yellow', 'Thunder Breathing master who is unconsciously lethal asleep','Action'),
      char('Inosuke Hashibira','Male',  'Supporting',  'Black',  'Beast Breathing dual swordsman raised by boars in the mountains','Action'),
      char('Kanao Tsuyuri',   'Female', 'Supporting',  'Brown',  'Flower Breathing; exceptional eyesight and precision',       'Action'),
      char('Giyu Tomioka',    'Male',   'Supporting',  'Black',  'Water Breathing Hashira; stoic and distant',                 'Action'),
      char('Shinobu Kocho',   'Female', 'Supporting',  'Black',  'Insect Breathing Hashira who uses poison instead of raw power','Action'),
      char('Rengoku Kyojuro', 'Male',   'Supporting',  'Blonde', 'Flame Breathing Hashira; enthusiastic and powerfully honorable','Action'),
      char('Tengen Uzui',     'Male',   'Supporting',  'White',  'Sound Breathing Hashira; flamboyant former shinobi',         'Action'),
      char('Muichiro Tokito', 'Male',   'Supporting',  'White',  'Mist Breathing Hashira; child prodigy with lost memories',   'Action'),
      char('Mitsuri Kanroji',  'Female','Supporting',  'Pink',   'Love Breathing Hashira with an unusually flexible body',     'Action'),
      char('Obanai Iguro',    'Male',   'Supporting',  'Black',  'Serpent Breathing Hashira; devoted to Mitsuri',              'Action'),
      char('Gyomei Himejima', 'Male',   'Supporting',  'Black',  'Stone Breathing Hashira; the physically strongest Hashira',  'Action'),
      char('Sanemi Shinazugawa','Male', 'Supporting',  'White',  'Wind Breathing Hashira; aggressive and scar-covered',        'Action'),
      char('Muzan Kibutsuji', 'Male',   'Antagonist',  'Black',  'Demon King who created all demons; fears the Sun',          'Action'),
      char('Akaza',           'Male',   'Antagonist',  'Pink',   'Upper Moon 3; Destructive Death martial arts technique',     'Action'),
      char('Doma',            'Female', 'Antagonist',  'Blonde', 'Upper Moon 2; Cryogenic ice techniques; hollow inside',      'Action'),
      char('Kokushibo',       'Male',   'Antagonist',  'Black',  'Upper Moon 1; Moon Breathing and Multiple Slashing Moons',   'Action'),
      char('Gyutaro',         'Male',   'Antagonist',  'Green',  'Upper Moon 6; Blood Sickle blood attacks; shares body with Daki','Action'),
      char('Daki',            'Female', 'Antagonist',  'White',  'Upper Moon 6; Obi sash manipulates flesh and fabric',        'Action'),
      char('Tamayo',          'Female', 'Supporting',  'Brown',  'Demon doctor working on a cure; uses blood-based sorcery',   'Action'),
      char('Enmu',            'Male',   'Antagonist',  'Black',  'Lower Moon 1; enters and controls people\'s dreams',         'Action'),
    ]],

    blueBox: ['Blue Box', 'Romance', [
      char('Taiki Inomata',  'Male',   'Protagonist', 'Black', 'Badminton player who falls for the basketball star above him','Romance'),
      char('Chinatsu Kano',  'Female', 'Protagonist', 'Brown', 'Basketball star who ends up living in Taiki\'s house',        'Romance'),
      char('Hina Chono',     'Female', 'Supporting',  'Brown', 'Taiki\'s badminton teammate who has feelings for him',        'Romance'),
      char('Ryuusei Umachi', 'Male',   'Supporting',  'Black', 'Taiki\'s cheerful and supportive best friend',               'Romance'),
      char('Haryu Kyo',      'Male',   'Supporting',  'Brown', 'Chinatsu\'s basketball teammate and rival of sorts',         'Romance'),
    ]],

    // ── SHARED (Caden, Gabe) ──────────────────────────────────────────────────

    dressingDarling: ['My Dress-Up Darling', 'Romance', [
      char('Wakana Gojo',   'Male',   'Protagonist', 'White',  'Hina doll craftsman who makes cosplay outfits for Marin',   'Romance'),
      char('Marin Kitagawa','Female', 'Protagonist', 'Blonde', 'Gyaru otaku passionate about cosplay and anime',             'Romance'),
      char('Sajuna Inui',   'Female', 'Supporting',  'Black',  'Professional cosplayer (Juju); petite and proud of her work','Romance'),
      char('Shinju Inui',   'Female', 'Supporting',  'Brown',  'Sajuna\'s taller younger sister who loves her sister deeply','Romance'),
      char('Kaoru Gojo',    'Male',   'Supporting',  'White',  'Wakana\'s grandfather and master hina doll craftsman',       'Romance'),
    ]],

    rezero: ['Re:Zero', 'Isekai', [
      char('Subaru Natsuki',   'Male',   'Protagonist', 'Black',   'Return by Death brings him back to a checkpoint on death', 'Isekai'),
      char('Emilia',           'Female', 'Protagonist', 'Silver',  'Half-elf spirit mage who is a royal selection candidate',  'Isekai'),
      char('Rem',              'Female', 'Supporting',  'Blue',    'Water magic and demon form; utterly devoted to Subaru',    'Isekai'),
      char('Ram',              'Female', 'Supporting',  'Pink',    'Wind magic; Rem\'s older sister with a broken horn',       'Isekai'),
      char('Beatrice',         'Female', 'Supporting',  'Blonde',  'Ancient spirit with vast magical power; contracts with Subaru','Isekai'),
      char('Roswaal L. Mathers','Male',  'Supporting',  'Multicolor','Eccentric court mage who orchestrates events from the shadows','Isekai'),
      char('Felt',             'Female', 'Supporting',  'Blonde',  'Thief from the slums revealed to be a royal candidate',    'Isekai'),
      char('Reinhard van Astrea','Male', 'Supporting',  'Red',     'Sword Saint with a divine protection that makes him invincible','Isekai'),
      char('Wilhelm van Astrea','Male',  'Supporting',  'Silver',  'The Sword Demon; legendary swordsman serving the Crusch Camp','Isekai'),
      char('Crusch Karsten',   'Female','Supporting',   'Green',   'Wind magic royal candidate who leads with military might',  'Isekai'),
      char('Anastasia Hoshin', 'Female','Supporting',   'Silver',  'Clever merchant royal candidate who loves efficient returns','Isekai'),
      char('Priscilla Barielle','Female','Supporting',  'Orange',  'Arrogant royal candidate who claims fate bends to her will','Isekai'),
      char('Julius Juukulius', 'Male',   'Supporting',  'Silver',  'Greatest spirit knight of Lugunica; Subaru\'s rival',      'Isekai'),
      char('Garfiel Tinsel',   'Male',   'Supporting',  'Blonde',  'Half-beast with a ferocious tiger transformation',         'Isekai'),
      char('Otto Suwen',       'Male',   'Supporting',  'Gray',    'Merchant who can communicate with animals; Subaru\'s ally','Isekai'),
      char('Frederica Baumann','Female', 'Supporting',  'Blonde',  'Beast-kin maid at Roswaal\'s manor',                      'Isekai'),
      char('Petelgeuse Romanée-Conti','Male','Antagonist','Black', 'Archbishop of Sloth who uses invisible hands to crush enemies','Isekai'),
      char('Elsa Granhiert',   'Female','Antagonist',   'Black',   'Bowel Hunter assassin who targets Emilia and her allies',  'Isekai'),
      char('Echidna',          'Female','Supporting',   'Black',   'Witch of Greed who collects knowledge; holds tea parties in dreams','Isekai'),
      char('Satella',          'Female','Antagonist',   'Silver',  'Witch of Envy who is both loved and feared; cursed Subaru','Isekai'),
    ]],

    ditf: ['Darling in the Franxx', 'Sci-Fi', [
      char('Hiro',     'Male',   'Protagonist', 'Black',  'Former prodigy who only activates with Zero Two as his partner','Sci-Fi'),
      char('Zero Two', 'Female', 'Protagonist', 'Pink',   'Half-klaxosaur elite pilot with horns and immense power',        'Sci-Fi'),
      char('Ichigo',   'Female', 'Supporting',  'Green',  'Squad 13 leader who pilots Delphinium; cares deeply for Hiro', 'Sci-Fi'),
      char('Goro',     'Male',   'Supporting',  'Brown',  'Ichigo\'s calm and dependable stamen partner',                  'Sci-Fi'),
      char('Miku',     'Female', 'Supporting',  'Orange', 'Pistil of Genista; competitive and short-tempered',             'Sci-Fi'),
      char('Zorome',   'Male',   'Supporting',  'Gray',   'Miku\'s stamen; arrogant but truly admires Papa\'s civilization','Sci-Fi'),
      char('Kokoro',   'Female', 'Supporting',  'Brown',  'Gentle pistil who becomes drawn to the idea of childbirth',     'Sci-Fi'),
      char('Mitsuru',  'Male',   'Supporting',  'White',  'Cold and resentful stamen who partners with Kokoro',            'Sci-Fi'),
      char('Futoshi',  'Male',   'Supporting',  'Brown',  'Kokoro\'s original devoted stamen; devastated when replaced',   'Sci-Fi'),
      char('Ikuno',    'Female', 'Supporting',  'Purple', 'Intellectual pistil who harbors feelings for Ichigo',           'Sci-Fi'),
      char('Nana',     'Female', 'Supporting',  'Orange', 'Adult caretaker of Squad 13 who once had emotions',             'Sci-Fi'),
      char('Hachi',    'Male',   'Supporting',  'Gray',   'Squad 13\'s stoic instructor alongside Nana',                  'Sci-Fi'),
    ]],

    callOfNight: ['Call of the Night', 'Other', [
      char('Kou Yamori',     'Male',   'Protagonist', 'Black',  'Insomniac middle schooler who wanders the night seeking something','Other'),
      char('Nazuna Nanakusa','Female', 'Protagonist', 'Blonde', 'Vampire who bites Kou; he needs to fall in love to transform','Other'),
      char('Seri Kikyou',    'Female', 'Supporting',  'Blue',   'Ruthless vampire hunter tracking down unauthorized vampires','Other'),
      char('Akira Asai',     'Female', 'Supporting',  'Brown',  'Kou\'s persistent childhood friend who searches for him at night','Other'),
      char('Mahiru Seki',    'Female', 'Supporting',  'Brown',  'Vampire who operates as a fortune teller at night',         'Other'),
      char('Kabura Honda',   'Female', 'Supporting',  'Brown',  'Vampire who acts as a motherly older sister figure',        'Other'),
      char('Hatsuka Suzushiro','Female','Supporting', 'Silver', 'Vampire working with Seri to monitor the situation',        'Other'),
    ]],

    aot: ['Attack on Titan', 'Action', [
      char('Eren Yeager',      'Male',   'Protagonist', 'Brown',  'Holds the Attack, Founding, and War Hammer Titans',         'Action'),
      char('Mikasa Ackerman',  'Female', 'Supporting',  'Black',  'Ackerman superhuman; the best soldier of her generation',  'Action'),
      char('Armin Arlert',     'Male',   'Supporting',  'Blonde', 'Strategist who later inherits the Colossal Titan',         'Action'),
      char('Levi Ackerman',    'Male',   'Supporting',  'Black',  'Humanity\'s Strongest Soldier; Ackerman bloodline',        'Action'),
      char('Hange Zoë',        'Other',  'Supporting',  'Brown',  'Survey Corps commander and passionate Titan researcher',   'Action'),
      char('Erwin Smith',      'Male',   'Supporting',  'Blonde', 'Charismatic Survey Corps commander who sacrifices everything','Action'),
      char('Historia Reiss',   'Female', 'Supporting',  'Blonde', 'True Queen of the Walls and heir to the Founding Titan',  'Action'),
      char('Ymir',             'Female', 'Supporting',  'Brown',  'Cynical survivor who secretly holds the Jaw Titan',        'Action'),
      char('Jean Kirstein',    'Male',   'Supporting',  'Brown',  'Initially self-serving soldier who grows into a true leader','Action'),
      char('Connie Springer',  'Male',   'Supporting',  'Black',  'Cheerful soldier whose village is transformed into Titans','Action'),
      char('Sasha Blouse',     'Female', 'Supporting',  'Brown',  'Potato Girl; instinctive hunter and skilled archer',       'Action'),
      char('Reiner Braun',     'Male',   'Antagonist',  'Blonde', 'Armored Titan; Marleyan warrior torn apart by dual loyalty','Action'),
      char('Bertholdt Hoover', 'Male',   'Antagonist',  'Brown',  'Colossal Titan who initiated the fall of Wall Maria',      'Action'),
      char('Annie Leonhart',   'Female', 'Antagonist',  'Blonde', 'Female Titan with crystal hardening and martial arts',     'Action'),
      char('Zeke Yeager',      'Male',   'Antagonist',  'Blonde', 'Beast Titan; Eren\'s half-brother with royal blood',      'Action'),
      char('Pieck Finger',     'Female', 'Supporting',  'Black',  'Cart Titan who supports Marley\'s war operations',        'Action'),
      char('Porco Galliard',   'Male',   'Antagonist',  'Brown',  'Jaw Titan who despises Reiner and the Warriors',          'Action'),
      char('Falco Grice',      'Male',   'Supporting',  'Brown',  'Young warrior candidate who later inherits the Jaw Titan', 'Action'),
      char('Gabi Braun',       'Female', 'Supporting',  'Brown',  'Fiercely devoted Marleyan warrior candidate; Reiner\'s cousin','Action'),
      char('Dot Pixis',        'Male',   'Supporting',  'Bald',   'Garrison commander who makes bold strategic decisions',    'Action'),
    ]],

    soloLeveling: ['Solo Leveling', 'Action', [
      char('Sung Jinwoo',   'Male',   'Protagonist', 'Black',  'Shadow Monarch who commands an army of the dead',           'Action'),
      char('Cha Hae-In',    'Female', 'Supporting',  'Blonde', 'S-rank Korean hunter drawn to Jinwoo\'s unique mana',      'Action'),
      char('Go Gunhee',     'Male',   'Supporting',  'Gray',   'Korean Hunter Association chairman who recognizes Jinwoo\'s potential','Action'),
      char('Woo Jinchul',   'Male',   'Supporting',  'Black',  'S-rank inspector who monitors Jinwoo on behalf of the Association','Action'),
      char('Yoo Jinho',     'Male',   'Supporting',  'Brown',  'Jinwoo\'s loyal friend and deputy master of Ahjin Guild',  'Action'),
      char('Sung Jinah',    'Female', 'Supporting',  'Black',  'Jinwoo\'s younger sister who he works to protect',         'Action'),
      char('Thomas Andre',  'Male',   'Supporting',  'Brown',  'America\'s National Level hunter; one of the world\'s strongest','Action'),
      char('Beru',          'Other',  'Supporting',  'Black',  'Ant King resurrected as Jinwoo\'s most powerful shadow',   'Action'),
      char('Igris',         'Other',  'Supporting',  'Black',  'Jinwoo\'s elite knight shadow; loyal beyond death',        'Action'),
      char('Antares',       'Other',  'Antagonist',  'Black',  'Monarch of Destruction; the Dragon King and final enemy',  'Action'),
    ]],

    angelNextDoor: ['The Angel Next Door Spoils Me Rotten', 'Romance', [
      char('Amane Fujimiya',  'Male',   'Protagonist', 'Brown',  'Self-sufficient loner slowly opened up by his neighbor',   'Romance'),
      char('Mahiru Shiina',   'Female', 'Protagonist', 'Blonde', 'Perfect "angel" classmate who becomes Amane\'s caretaker','Romance'),
      char('Itsuki Akazawa',  'Male',   'Supporting',  'Brown',  'Amane\'s cheerful best friend who sees through his act',  'Romance'),
      char('Chitose Shirakawa','Female','Supporting',  'Pink',   'Energetic girl who is Itsuki\'s girlfriend and Mahiru\'s friend','Romance'),
      char('Shuutaro Fujimiya','Male',  'Supporting',  'Brown',  'Amane\'s easygoing father who approves of Mahiru',        'Romance'),
      char('Kayako Fujimiya', 'Female', 'Supporting',  'Blonde', 'Amane\'s fashionable mother who adores Mahiru',           'Romance'),
    ]],

    // ── CADEN ONLY ────────────────────────────────────────────────────────────

    deathNote: ['Death Note', 'Other', [
      char('Light Yagami',    'Male',   'Protagonist', 'Brown',  'Uses the Death Note to execute criminals and become a god','Other'),
      char('L',               'Male',   'Antagonist',  'Black',  'World\'s greatest detective; deduces Kira\'s identity',   'Other'),
      char('Ryuk',            'Other',  'Supporting',  'Black',  'Shinigami who dropped the Death Note out of boredom',      'Other'),
      char('Misa Amane',      'Female', 'Supporting',  'Blonde', 'Shinigami Eyes user; fanatically devoted to Light as Kira','Other'),
      char('Near',            'Male',   'Supporting',  'White',  'L\'s successor who ultimately defeats Kira',              'Other'),
      char('Mello',           'Male',   'Supporting',  'Blonde', 'L\'s other successor who uses the mafia to pursue Kira',  'Other'),
      char('Watari',          'Male',   'Supporting',  'White',  'L\'s guardian and handler who provides field support',    'Other'),
      char('Soichiro Yagami', 'Male',   'Supporting',  'Brown',  'Light\'s father; NPA chief investigating the Kira case',  'Other'),
      char('Touta Matsuda',   'Male',   'Supporting',  'Black',  'Emotional NPA detective on the Kira task force',          'Other'),
      char('Rem',             'Other',  'Supporting',  'White',  'Shinigami assigned to Misa; sacrifices herself for her',  'Other'),
      char('Teru Mikami',     'Male',   'Antagonist',  'Black',  'Kira\'s fanatical proxy who wields a second Death Note',  'Other'),
      char('Kiyomi Takada',   'Female', 'Supporting',  'Brown',  'Kira\'s public spokesperson; former classmate of Light',  'Other'),
    ]],

    codeGeass: ['Code Geass', 'Action', [
      char('Lelouch vi Britannia', 'Male',   'Protagonist', 'Black',  'Geass forces absolute obedience; leads Zero Requiem',     'Action'),
      char('C.C.',               'Female', 'Supporting',  'Green',  'Code-bearer who grants Lelouch his Geass power',          'Action'),
      char('Suzaku Kururugi',    'Male',   'Supporting',  'Brown',  'Lancelot Knightmare ace with a Live command reinforcing his body','Action'),
      char('Kallen Kozuki',      'Female', 'Supporting',  'Red',    'Ace Knightmare pilot of the Guren; Black Knights\' best',  'Action'),
      char('Euphemia li Britannia','Female','Supporting', 'Pink',   'Third princess who creates the Special Administrative Zone','Action'),
      char('Nunnally vi Britannia','Female','Supporting', 'Brown',  'Lelouch\'s blind sister; his primary motivation',          'Action'),
      char('Shirley Fenette',    'Female', 'Supporting',  'Orange', 'Lelouch\'s classmate who loves him despite the truth',     'Action'),
      char('Milly Ashford',      'Female', 'Supporting',  'Blonde', 'Ouran Academy student council president; Lelouch\'s friend','Action'),
      char('Nina Einstein',      'Female', 'Supporting',  'Brown',  'Brilliant but unstable scientist who creates the FLEIJA bomb','Action'),
      char('Rivalz Cardemonde',  'Male',   'Supporting',  'Blue',   'Lelouch\'s ordinary, cheerful classmate',                  'Action'),
      char('Jeremiah Gottwald',  'Male',   'Supporting',  'Blonde', 'Orange; Geass Canceller allows him to nullify any Geass',  'Action'),
      char('Schneizel el Britannia','Male','Antagonist',  'Blonde', 'Second Prince; Lelouch\'s most dangerous intellectual rival','Action'),
      char('Charles zi Britannia','Male',  'Antagonist',  'Silver', 'Emperor with a Geass that rewrites memories',              'Action'),
      char('Rolo Lamperouge',    'Male',   'Antagonist',  'Brown',  'Geass stops time perception in a radius; assassin posing as Lelouch\'s brother','Action'),
      char('Anya Alstreim',      'Female', 'Supporting',  'Pink',   'Knight of Round with a Geass-altered past and memory loss','Action'),
      char('Cornelia li Britannia','Female','Supporting', 'Purple', 'Second Princess; brilliant military commander',            'Action'),
      char('V.V.',               'Male',   'Antagonist',  'Blonde', 'Charles\'s twin Code-bearer who operates the Geass Order','Action'),
    ]],

    seraphEnd: ['Seraph of the End', 'Action', [
      char('Yuichiro Hyakuya', 'Male',   'Protagonist', 'Black',  'Demon weapon Ashuramaru enhances him with demonic power',  'Action'),
      char('Mikaela Hyakuya',  'Male',   'Supporting',  'Blonde', 'Yuu\'s best friend turned vampire; fights to reclaim Yuu', 'Action'),
      char('Shinoa Hiragi',    'Female', 'Supporting',  'Purple', 'Wields Shikama Doji demon weapon; sharp and sarcastic',    'Action'),
      char('Mitsuba Sangu',    'Female', 'Supporting',  'Pink',   'Asuramaru-series Tenjiryuu axe demon weapon user',         'Action'),
      char('Kimizuki Shihou',  'Male',   'Supporting',  'Pink',   'Wields twin demon swords; fights to cure his sick sister',  'Action'),
      char('Yoichi Saotome',   'Male',   'Supporting',  'Brown',  'Demon bow Gekkoin user; gentle but determined',            'Action'),
      char('Guren Ichinose',   'Male',   'Supporting',  'Black',  'Colonel who rebuilt the world after the virus; wields Mahiru-no-Yo','Action'),
      char('Ferid Bathory',    'Male',   'Antagonist',  'Silver', '7th Progenitor vampire who manipulates events for his own amusement','Action'),
      char('Krul Tepes',       'Female', 'Supporting',  'Pink',   '3rd Progenitor and queen of Japan\'s vampires',           'Action'),
      char('Crowley Eusford',  'Male',   'Antagonist',  'Red',    '13th Progenitor who serves under Ferid; incredibly powerful','Action'),
      char('Shiho Kimizuki',   'Female', 'Supporting',  'Pink',   'Kimizuki\'s hospitalized younger sister (referenced)',     'Action'),
    ]],

    fireForce: ['Fire Force', 'Action', [
      char('Shinra Kusakabe',  'Male',   'Protagonist', 'Black',  'Devil\'s Footprints ignite his feet for rocket propulsion','Action'),
      char('Arthur Boyle',     'Male',   'Supporting',  'Blonde', 'Excalibur plasma sword; power depends on how heroic he acts','Action'),
      char('Maki Oze',         'Female', 'Supporting',  'Black',  'Manipulates existing flames without producing her own',    'Action'),
      char('Tamaki Kotatsu',   'Female', 'Supporting',  'Brown',  'Nekomata ability; infamous Lucky Lecher reflex',           'Action'),
      char('Iris',             'Female', 'Supporting',  'Black',  'Nun who prays to purify Infernals as they pass on',        'Action'),
      char('Akitaru Obi',      'Male',   'Supporting',  'Black',  'Non-powered captain who relies on extreme physical fitness','Action'),
      char('Takehisa Hinawa',  'Male',   'Supporting',  'Black',  'Kinetic energy control over bullets; cold and precise',    'Action'),
      char('Benimaru Shinmon', 'Male',   'Supporting',  'Black',  'Hybrid Second and Third Generation flame user; prodigious','Action'),
      char('Joker',            'Male',   'Supporting',  'Black',  'Rogue enforcer who manipulates fire; pursues the truth',   'Action'),
      char('Sho Kusakabe',     'Male',   'Antagonist',  'White',  'Severed Universe slows everything except himself; Shinra\'s brother','Action'),
      char('Charon',           'Male',   'Antagonist',  'Black',  'Converts kinetic energy into thermal energy; Haumea\'s bodyguard','Action'),
      char('Haumea',           'Female', 'Antagonist',  'Blonde', 'Electricity manipulation over the nervous system',         'Action'),
      char('Inca Kasugatani',  'Female', 'Antagonist',  'Brown',  'Sees lines of combustion before they happen',              'Action'),
      char('Vulcan Joseph',    'Male',   'Supporting',  'Brown',  'Mechanical genius engineer who joins Company 8',           'Action'),
      char('Viktor Licht',     'Male',   'Supporting',  'Blonde', 'Scientist and secret agent of Haijima Industries',        'Action'),
    ]],

    konosuba: ['Konosuba', 'Comedy', [
      char('Kazuma Satou',     'Male',   'Protagonist', 'Brown',  'Maxes out Luck and uses all basic skills; shrewd and petty','Comedy'),
      char('Aqua',             'Female', 'Supporting',  'Blue',   'Useless goddess with powerful water magic and zero sense',  'Comedy'),
      char('Megumin',          'Female', 'Supporting',  'Brown',  'Explosion magic one-shot wonder who collapses after casting','Comedy'),
      char('Darkness',         'Female', 'Supporting',  'Blonde', 'Masochistic crusader tank who loves taking hits',          'Comedy'),
      char('Wiz',              'Female', 'Supporting',  'Brown',  'Lich shopkeeper whose powerful magic is constantly wasted','Comedy'),
      char('Vanir',            'Male',   'Supporting',  'Black',  'Duke of Hell who sells masks and feeds on negative emotion','Comedy'),
      char('Yunyun',           'Female', 'Supporting',  'Brown',  'Megumin\'s self-proclaimed rival who is desperately lonely','Comedy'),
      char('Chris',            'Female', 'Supporting',  'Silver', 'Thief who moonlights as the goddess Eris in disguise',     'Comedy'),
      char('Dust',             'Male',   'Supporting',  'Brown',  'Lazy adventurer and loan shark nemesis of Kazuma\'s party', 'Comedy'),
    ]],

    tensura: ['That Time I Got Reincarnated as a Slime', 'Isekai', [
      char('Rimuru Tempest',  'Other',  'Protagonist', 'Blue',   'Predator and Great Sage abilities; becomes a Demon Lord',  'Isekai'),
      char('Shion',           'Female', 'Supporting',  'Purple', 'Rimuru\'s secretary; enormous power and terrible cooking', 'Isekai'),
      char('Shuna',           'Female', 'Supporting',  'Pink',   'Ogre princess with barrier magic and weaving talent',      'Isekai'),
      char('Benimaru',        'Male',   'Supporting',  'Red',    'Ogre king with fire and black flame control',              'Isekai'),
      char('Ranga',           'Other',  'Supporting',  'Black',  'Fenrir wolf who serves as Rimuru\'s loyal shadow',         'Isekai'),
      char('Gobta',           'Male',   'Supporting',  'Green',  'Goblin warrior who is absurdly lucky in battle',           'Isekai'),
      char('Milim Nava',      'Female', 'Supporting',  'Pink',   'Dragonoid Demon Lord with a Destroyer ability',           'Isekai'),
      char('Diablo',          'Male',   'Supporting',  'Black',  'Primordial Black demon with absolute loyalty to Rimuru',   'Isekai'),
      char('Souei',           'Male',   'Supporting',  'Black',  'Shadow manipulation and espionage for Tempest',           'Isekai'),
      char('Hakurou',         'Male',   'Supporting',  'White',  'Ancient sword master goblin who serves Rimuru',           'Isekai'),
      char('Veldora Tempest', 'Male',   'Supporting',  'Blue',   'Storm Dragon sealed for 300 years; Rimuru\'s first friend','Isekai'),
      char('Clayman',         'Male',   'Antagonist',  'Silver', 'Puppet master Demon Lord who manipulates other lords',    'Isekai'),
      char('Hinata Sakaguchi','Female', 'Antagonist',  'Blonde', 'Holy Knight leader who views Rimuru as a threat',         'Isekai'),
      char('Guy Crimson',     'Male',   'Supporting',  'Red',    'The oldest and most powerful Demon Lord',                  'Isekai'),
      char('Leon Cromwell',   'Male',   'Supporting',  'Blonde', 'Demon Lord who summoned Shizu to this world',             'Isekai'),
    ]],

    tokyoGhoul: ['Tokyo Ghoul', 'Action', [
      char('Ken Kaneki',        'Male',   'Protagonist', 'White',  'Ghoul hybrid with a centipede kagune; seeks a peaceful coexistence','Action'),
      char('Touka Kirishima',   'Female', 'Supporting',  'Purple', 'Ukaku kagune fires crystallized shards; works at Anteiku','Action'),
      char('Yoshimura',         'Male',   'Supporting',  'Silver', 'Anteiku owner hiding a past as the fearsome Owl',        'Action'),
      char('Hinami Fueguchi',   'Female', 'Supporting',  'Brown',  'Hybrid dual-type kagune combining both parents\' types',  'Action'),
      char('Nishiki Nishio',    'Male',   'Supporting',  'Brown',  'Koukaku kagune; protective of his human girlfriend',     'Action'),
      char('Hideyoshi Nagachika','Male',  'Supporting',  'Blonde', 'Kaneki\'s perceptive human best friend who knows the truth','Action'),
      char('Juuzou Suzuya',     'Male',   'Supporting',  'White',  'CCG investigator with unique Quinque and erratic fighting','Action'),
      char('Kishou Arima',      'Male',   'Supporting',  'Silver', 'The Undefeated Reaper; the CCG\'s strongest investigator','Action'),
      char('Eto Yoshimura',     'Female', 'Antagonist',  'Green',  'One-Eyed Owl; author Sen Takatsuki manipulating from the shadows','Action'),
      char('Seidou Takizawa',   'Male',   'Antagonist',  'Brown',  'CCG investigator tortured into becoming a kakuja ghoul', 'Action'),
      char('Ayato Kirishima',   'Male',   'Antagonist',  'Purple', 'Ukaku kagune user; Touka\'s angry younger brother',      'Action'),
      char('Tatara',            'Male',   'Antagonist',  'White',  'Aogiri Tree high commander with fire-type kagune',       'Action'),
      char('Kureo Mado',        'Male',   'Supporting',  'Gray',   'CCG investigator obsessed with collecting Quinques',     'Action'),
      char('Akira Mado',        'Female', 'Supporting',  'Brown',  'CCG investigator and Kureo\'s daughter; Takizawa\'s partner','Action'),
      char('Rize Kamishiro',    'Female', 'Antagonist',  'Purple', 'Binge Eater whose kakuhou were transplanted into Kaneki', 'Action'),
    ]],

    vinlandSaga: ['Vinland Saga', 'Action', [
      char('Thorfinn',    'Male', 'Protagonist', 'Blonde', 'Knife-fighting warrior seeking revenge then embracing pacifism','Action'),
      char('Askeladd',    'Male', 'Antagonist',  'Gray',   'Cunning Welsh mercenary captain who killed Thorfinn\'s father','Action'),
      char('Thorkell',    'Male', 'Supporting',  'Blonde', 'Colossal warrior who loves fighting strong opponents',          'Action'),
      char('Canute',      'Male', 'Supporting',  'Silver', 'Danish prince who transforms from timid to ruthless king',     'Action'),
      char('Thors',       'Male', 'Supporting',  'Blonde', 'Legendary Jomsviking warrior; Thorfinn\'s father and idol',   'Action'),
      char('Leif Ericson','Male', 'Supporting',  'Red',    'Explorer and Thorfinn\'s surrogate uncle who seeks Vinland',   'Action'),
      char('Floki',       'Male', 'Antagonist',  'Gray',   'Jomsviking commander who ordered Thors\'s assassination',     'Action'),
      char('Bjorn',       'Male', 'Supporting',  'Brown',  'Askeladd\'s berserker lieutenant and loyal friend',            'Action'),
      char('Einar',       'Male', 'Supporting',  'Blonde', 'Slave who becomes Thorfinn\'s closest friend on the farm',    'Action'),
      char('Snake',       'Male', 'Supporting',  'Black',  'Ketil\'s head guard with mysterious past fighting skills',     'Action'),
      char('Arnheid',     'Female','Supporting', 'Brown',  'Farm slave with a tragic secret past',                         'Action'),
      char('Ketil',       'Male', 'Supporting',  'Brown',  'Farm owner who presents a kind face hiding cruelty',          'Action'),
    ]],

    trinitySeven: ['Trinity Seven', 'Action', [
      char('Arata Kasuga',       'Male',   'Protagonist', 'Brown',  'Demon Lord Candidate using Astil Codex grimoire',           'Action'),
      char('Lilith Asami',       'Female', 'Supporting',  'Red',    'Superbia Archive magic researcher and Arata\'s teacher',   'Action'),
      char('Yui Kurata',         'Female', 'Supporting',  'Blonde', 'Ira Archive mage who sleeps constantly to control her power','Action'),
      char('Levi Kazama',        'Female', 'Supporting',  'Black',  'Invidia Archive ninja with exceptional close combat speed', 'Action'),
      char('Mira Yamana',        'Female', 'Supporting',  'Silver', 'Luxuria Archive and Paladin of the Magic King',            'Action'),
      char('Akio Fudo',          'Female', 'Supporting',  'Brown',  'Avaritia Archive physical combat specialist',              'Action'),
      char('Lieselotte Sherlock','Female', 'Antagonist',  'Black',  'Acedia Archive; her power devours everything around her',  'Action'),
      char('Arin Kannazuki',     'Female', 'Supporting',  'Black',  'Grimoire Safety embodiment who resembles Arata\'s cousin', 'Action'),
      char('Selina Sherlock',    'Female', 'Supporting',  'Blonde', 'Lieselotte\'s twin; reporter documenting magic events',    'Action'),
      char('Hijiri Kasuga',      'Female', 'Supporting',  'Brown',  'Arata\'s cousin whose disappearance started everything',   'Action'),
    ]],

    fate: ['Fate/Stay Night', 'Action', [
      char('Shirou Emiya',    'Male',   'Protagonist', 'Orange', 'Reinforcement and Projection magic; traces Noble Phantasms', 'Action'),
      char('Saber',           'Female', 'Supporting',  'Blonde', 'King Arthur wielding Excalibur; swift and noble',            'Action'),
      char('Rin Tohsaka',     'Female', 'Supporting',  'Black',  'Gem magic and Gandr shot; talented dual-element mage',       'Action'),
      char('Archer',          'Male',   'Supporting',  'White',  'Unlimited Blade Works traces and projects any weapon seen',  'Action'),
      char('Lancer',          'Male',   'Supporting',  'Blue',   'Cu Chulainn wields Gáe Bolg which always pierces the heart','Action'),
      char('Berserker',       'Male',   'Supporting',  'Black',  'Heracles with God Hand grants twelve lives of immortality',  'Action'),
      char('Rider',           'Female', 'Supporting',  'Purple', 'Medusa uses Mystic Eyes of Petrification and Bellerophon',   'Action'),
      char('Caster',          'Female', 'Antagonist',  'Purple', 'Medea wields Rule Breaker which negates any magic or contract','Action'),
      char('Assassin',        'Male',   'Supporting',  'Black',  'Sasaki Kojiro\'s Tsubame Gaeshi is a physically impossible sword technique','Action'),
      char('Gilgamesh',       'Male',   'Antagonist',  'Blonde', 'Gate of Babylon fires every weapon as a Noble Phantasm',    'Action'),
      char('Illyasviel von Einzbern','Female','Supporting','White','Berserker\'s master; Einzbern homunculus with vast mana',  'Action'),
      char('Kirei Kotomine',  'Male',   'Antagonist',  'Black',  'Executor priest who pursues Angra Mainyu out of emptiness', 'Action'),
      char('Sakura Matou',    'Female', 'Supporting',  'Purple', 'Rin\'s younger sister; vessel for the Shadow in Heaven\'s Feel','Action'),
      char('Zouken Matou',    'Male',   'Antagonist',  'Gray',   'Ancient mage who maintains immortality through worm familiars','Action'),
      char('Taiga Fujimura',  'Female', 'Supporting',  'Brown',  'Shirou\'s guardian and homeroom teacher; nicknamed Tiger', 'Action'),
      char('Kiritsugu Emiya', 'Male',   'Supporting',  'Black',  'Mage Killer who used Time Alter and Origin Bullets; Shirou\'s adoptive father','Action'),
    ]],

    edgerunners: ['Cyberpunk Edgerunners', 'Sci-Fi', [
      char('David Martinez', 'Male',   'Protagonist', 'Brown',  'Sandevistan chrome lets him move faster than anyone can see','Sci-Fi'),
      char('Lucy',           'Female', 'Supporting',  'White',  'Elite netrunner who hacks any system while jacking in',     'Sci-Fi'),
      char('Maine',          'Male',   'Supporting',  'Black',  'Edgerunner leader with a full chrome body; mentor to David','Sci-Fi'),
      char('Dorio',          'Female', 'Supporting',  'Brown',  'Maine\'s loyal girlfriend; heavily cyberized tank',         'Sci-Fi'),
      char('Kiwi',           'Female', 'Supporting',  'Black',  'Skilled netrunner who plays all sides for survival',        'Sci-Fi'),
      char('Rebecca',        'Female', 'Supporting',  'Blonde', 'Tiny but ferociously aggressive gunner with oversized weapons','Sci-Fi'),
      char('Pilar',          'Male',   'Supporting',  'Brown',  'Rebecca\'s brother; reckless and fun-loving edgerunner',   'Sci-Fi'),
      char('Falco',          'Male',   'Supporting',  'Gray',   'Experienced driver and pilot who keeps the crew mobile',    'Sci-Fi'),
      char('Gloria Martinez','Female', 'Supporting',  'Brown',  'David\'s mother who works for Trauma Team; drives his ambition','Sci-Fi'),
      char('Adam Smasher',   'Male',   'Antagonist',  'None',   'Full-borg Arasaka enforcer with no humanity remaining',     'Sci-Fi'),
      char('Faraday',        'Male',   'Antagonist',  'Black',  'Mysterious corpo fixer who manipulates the crew',          'Sci-Fi'),
    ]],

    dateALive: ['Date A Live', 'Action', [
      char('Shidou Itsuka',   'Male',   'Protagonist', 'Brown',  'Seals Spirit powers by making them fall in love and kissing','Action'),
      char('Tohka Yatogami', 'Female', 'Protagonist', 'Purple', 'Princess Spirit wielding the Sandalphon holy sword',         'Action'),
      char('Origami Tobiichi','Female', 'Supporting',  'White',  'AST elite who later becomes the Spirit Angel',              'Action'),
      char('Yoshino',         'Female', 'Supporting',  'Blue',   'Gentle Spirit who speaks through her puppet Yoshinon',     'Action'),
      char('Kotori Itsuka',   'Female', 'Supporting',  'Red',    'Shidou\'s sister; Efreet fire Spirit and Ratatoskr chief', 'Action'),
      char('Kurumi Tokisaki', 'Female', 'Antagonist',  'Black',  'Nightmare Spirit; Zafkiel clock fires bullets of time',    'Action'),
      char('Miku Izayoi',     'Female', 'Supporting',  'Blue',   'Diva Spirit who uses Gabriel to control people with music','Action'),
      char('Natsumi',         'Female', 'Supporting',  'Orange', 'Witch Spirit whose Hanael transforms anything at will',    'Action'),
      char('Nia Honjou',      'Female', 'Supporting',  'Silver', 'Rasiel is an all-knowing book that reveals any information','Action'),
      char('Reine Murasame',  'Female', 'Supporting',  'Purple', 'Ratatoskr analyst who never sleeps',                      'Action'),
    ]],

    prisonSchool: ['Prison School', 'Comedy', [
      char('Kiyoshi Fujino',  'Male',   'Protagonist', 'Brown',  'Innocent student trying to see girls; repeatedly foiled',  'Comedy'),
      char('Takehito Morokuzu','Male',  'Supporting',  'Brown',  'Brilliant strategist obsessed with Romance of the Three Kingdoms','Comedy'),
      char('Shingo Wakamoto', 'Male',   'Supporting',  'Brown',  'Social climber who betrays the group for personal gain',   'Comedy'),
      char('Joe Jouji',       'Male',   'Supporting',  'Brown',  'Quiet masochist who suffers cheerfully',                   'Comedy'),
      char('Reiji Andou',     'Male',   'Supporting',  'Brown',  'Extreme masochist who worships Meiko',                     'Comedy'),
      char('Meiko Shiraki',   'Female', 'Antagonist',  'Brown',  'Sadistic Vice President who enforces punishment with a whip','Comedy'),
      char('Mari Kurihara',   'Female', 'Antagonist',  'Black',  'Underground Student Council President; cold and calculating','Comedy'),
      char('Hana Midorikawa', 'Female', 'Antagonist',  'Brown',  'Martial arts expert with an obsessive grudge against Kiyoshi','Comedy'),
      char('Chiyo Kurihara',  'Female', 'Supporting',  'Brown',  'Mari\'s kind-hearted younger sister who loves sumo',       'Comedy'),
      char('Kate Takenomiya', 'Female', 'Antagonist',  'Blonde', 'New USC President who wants to abolish the Prison',        'Comedy'),
    ]],

    testament: ['The Testament of Sister New Devil', 'Action', [
      char('Basara Toujou',  'Male',   'Protagonist', 'Brown',  'Hero clan member using Banishing Shift and a holy sword',  'Action'),
      char('Mio Naruse',     'Female', 'Protagonist', 'Red',    'Demon lord\'s daughter with destructive magic potential',   'Action'),
      char('Maria Naruse',   'Female', 'Supporting',  'Silver', 'Succubus who serves as Mio\'s familiar',                   'Action'),
      char('Yuki Nonaka',    'Female', 'Supporting',  'Silver', 'Hero clan member wielding an ice elemental sword',         'Action'),
      char('Kurumi Nonaka',  'Female', 'Supporting',  'Brown',  'Yuki\'s energetic younger sister in the hero clan',        'Action'),
      char('Chisato Hasegawa','Female','Supporting',  'Blonde', 'School nurse secretly hiding her identity as a goddess',   'Action'),
      char('Lars',           'Male',   'Supporting',  'Brown',  'Demon spy working both sides of the conflict',              'Action'),
    ]],

    narutoFull: ['Naruto', 'Action', [
      char('Naruto Uzumaki',    'Male',   'Protagonist', 'Blonde', 'Nine-Tails jinchuriki; Shadow Clone and Rasengan master',  'Action'),
      char('Sasuke Uchiha',     'Male',   'Supporting',  'Black',  'Sharingan and Chidori; seeks to kill his brother Itachi', 'Action'),
      char('Sakura Haruno',     'Female', 'Supporting',  'Pink',   'Medical ninjutsu and superhuman strength from chakra control','Action'),
      char('Kakashi Hatake',    'Male',   'Supporting',  'Silver', 'Copy Ninja with Sharingan who can mimic any technique',   'Action'),
      char('Iruka Umino',       'Male',   'Supporting',  'Brown',  'Academy teacher and Naruto\'s first father figure',       'Action'),
      char('Jiraiya',           'Male',   'Supporting',  'White',  'Sage Mode with toad summons; Naruto\'s godfather',        'Action'),
      char('Tsunade',           'Female', 'Supporting',  'Blonde', 'Strength of a Hundred healing technique; Fifth Hokage',   'Action'),
      char('Orochimaru',        'Male',   'Antagonist',  'Black',  'Immortality via body transfer; snake and forbidden jutsu','Action'),
      char('Itachi Uchiha',     'Male',   'Antagonist',  'Black',  'Mangekyou Sharingan; Tsukuyomi and Amaterasu genjutsu',  'Action'),
      char('Gaara',             'Male',   'Supporting',  'Red',    'Sand manipulation; One-Tail jinchuriki who becomes Kazekage','Action'),
      char('Rock Lee',          'Male',   'Supporting',  'Black',  'Eight Inner Gates; pure taijutsu with no ninjutsu or genjutsu','Action'),
      char('Neji Hyuga',        'Male',   'Supporting',  'Brown',  'Byakugan and Gentle Fist; prodigy of the Hyuga branch',  'Action'),
      char('Tenten',            'Female', 'Supporting',  'Brown',  'Scrolls summon hundreds of weapons with perfect aim',     'Action'),
      char('Hinata Hyuga',      'Female', 'Supporting',  'Black',  'Byakugan and Gentle Step Twin Lion Fists',               'Action'),
      char('Kiba Inuzuka',      'Male',   'Supporting',  'Brown',  'Beast Human Clone techniques with his partner Akamaru',   'Action'),
      char('Shino Aburame',     'Male',   'Supporting',  'Black',  'Insect colony manipulation through kikaichuu bugs',       'Action'),
      char('Shikamaru Nara',    'Male',   'Supporting',  'Black',  'Shadow techniques bind targets; strategic genius',        'Action'),
      char('Choji Akimichi',    'Male',   'Supporting',  'Brown',  'Multi-Size expansion technique and Butterfly Mode',       'Action'),
      char('Ino Yamanaka',      'Female', 'Supporting',  'Blonde', 'Mind Transfer Jutsu takes over a target\'s body',        'Action'),
      char('Asuma Sarutobi',    'Male',   'Supporting',  'Black',  'Wind Release chakra blades; Third Hokage\'s son',        'Action'),
      char('Kurenai Yuhi',      'Male',   'Supporting',  'Black',  'Genjutsu specialist and Team 8\'s leader',               'Action'),
      char('Guy Might',         'Male',   'Supporting',  'Black',  'Eight Inner Gates master and taijutsu specialist',        'Action'),
      char('Zabuza Momochi',    'Male',   'Antagonist',  'Gray',   'Silent Killing technique with the Kubikiriboucho sword',  'Action'),
      char('Haku',              'Other',  'Supporting',  'Brown',  'Ice Style: Mirrored Ice Crystal Technique; Zabuza\'s tool','Action'),
      char('Nagato (Pain)',     'Male',   'Antagonist',  'Orange', 'Rinnegan controls Six Paths of Pain; seeks world peace through war','Action'),
      char('Konan',             'Female', 'Supporting',  'Blue',   'Paper Angel technique turns her body into billions of papers','Action'),
      char('Obito Uchiha',      'Male',   'Antagonist',  'Black',  'Kamui space-time ninjutsu; the real mastermind behind much of the war','Action'),
      char('Madara Uchiha',     'Male',   'Antagonist',  'Black',  'Eternal Mangekyou Sharingan; Susanoo and Rinnegan powers', 'Action'),
      char('Minato Namikaze',   'Male',   'Supporting',  'Blonde', 'Flying Thunder God teleportation; Fourth Hokage',         'Action'),
      char('Kushina Uzumaki',   'Female', 'Supporting',  'Red',    'Chain techniques; the previous Nine-Tails jinchuriki',    'Action'),
      char('Killer Bee',        'Male',   'Supporting',  'Brown',  'Eight-Tails jinchuriki; fights with seven swords while rapping','Action'),
      char('Temari',            'Female', 'Supporting',  'Blonde', 'Giant iron fan wind techniques; Gaara\'s sister',        'Action'),
      char('Kankuro',           'Male',   'Supporting',  'Brown',  'Puppet master who controls Sasori\'s old puppet body',    'Action'),
      char('Deidara',           'Male',   'Antagonist',  'Blonde', 'Explosive clay art that detonates on command',            'Action'),
      char('Sasori',            'Male',   'Antagonist',  'Red',    'Puppet master who converted his own body into a puppet',  'Action'),
      char('Kisame Hoshigaki',  'Male',   'Antagonist',  'Blue',   'Samehada sword absorbs chakra; Water Release master',    'Action'),
      char('Kabuto Yakushi',    'Male',   'Antagonist',  'Gray',   'Medical ninjutsu and later Snake Sage Mode',              'Action'),
      char('Danzo Shimura',     'Male',   'Antagonist',  'Gray',   'Izanagi Sharingan arm; ruthless leader of Root ANBU',    'Action'),
      char('Sai',               'Male',   'Supporting',  'Black',  'Ink clone technique brings painted animals to life',      'Action'),
      char('Yamato',            'Male',   'Supporting',  'Brown',  'Wood Release can suppress the Nine-Tails; replaced Kakashi','Action'),
      char('Anko Mitarashi',    'Female', 'Supporting',  'Brown',  'Snake techniques learned under Orochimaru; brash and fierce','Action'),
      char('Zetsu',             'Other',  'Antagonist',  'Black',  'Black and White Zetsu spy everywhere; Madara\'s will',    'Action'),
    ]],

    erased: ['Erased', 'Other', [
      char('Satoru Fujinuma',  'Male',   'Protagonist', 'Brown', 'Revival sends him back minutes before a tragedy to prevent it','Other'),
      char('Kayo Hinazuki',    'Female', 'Supporting',  'Brown', 'Abused classmate Satoru is determined to save',              'Other'),
      char('Sachiko Fujinuma', 'Female', 'Supporting',  'Brown', 'Satoru\'s sharp and perceptive mother who uncovers the truth','Other'),
      char('Gaku Yashiro',     'Male',   'Antagonist',  'Brown', 'Charismatic teacher hiding his identity as a serial killer', 'Other'),
      char('Kenya Kobayashi',  'Male',   'Supporting',  'Brown', 'Satoru\'s perceptive childhood friend who senses something is off','Other'),
      char('Hiromi Sugita',    'Male',   'Supporting',  'Brown', 'One of Satoru\'s childhood friends targeted by the killer',  'Other'),
      char('Airi Katagiri',    'Female', 'Supporting',  'Brown', 'Satoru\'s adult coworker who believes in him unconditionally','Other'),
    ]],

    shikimori: ['Shikimori\'s Not Just a Cutie', 'Romance', [
      char('Yuu Izumi',         'Male',   'Protagonist', 'Brown', 'Terminally unlucky but warm-hearted boyfriend',              'Romance'),
      char('Micchon Shikimori', 'Female', 'Protagonist', 'Black', 'Switches between adorably cute and coolly heroic in seconds','Romance'),
      char('Inuzuka',           'Male',   'Supporting',  'Brown', 'Izumi\'s straightforward and reliable best friend',         'Romance'),
      char('Nekozaki',          'Female', 'Supporting',  'Brown', 'Shikimori\'s cheerful and upbeat friend',                   'Romance'),
      char('Hachimitsu',        'Female', 'Supporting',  'Blonde','Shikimori\'s soft-spoken and kind friend',                  'Romance'),
    ]],

    midnightHeart: ['Tune In To The Midnight Heart', 'Romance', [
      char('Yamabuki Utsuro', 'Male',   'Protagonist', 'Black', 'Secretly hosts a midnight radio show under an alias',         'Romance'),
      char('Totoko Tsukishima','Female','Protagonist', 'Brown', 'Listens to the midnight show and discovers the host\'s identity','Romance'),
    ]],

    danDaDan: ['Dan Da Dan', 'Action', [
      char('Momo Ayase',       'Female', 'Protagonist', 'Brown',  'Psychic powers drawn out by supernatural encounters',      'Action'),
      char('Ken Takakura',     'Male',   'Protagonist', 'Brown',  'Gains alien powers after a paranormal encounter',           'Action'),
      char('Turbo Granny',     'Female', 'Antagonist',  'Gray',   'Cursed spirit who runs at supernatural speed',              'Action'),
      char('Aira Shiratori',   'Female', 'Supporting',  'Blonde', 'School idol who becomes entangled in paranormal events',    'Action'),
      char('Jiji',             'Male',   'Supporting',  'Brown',  'Okarun\'s friend who also encounters the supernatural',     'Action'),
      char('Seiko Ayase',      'Female', 'Supporting',  'Brown',  'Momo\'s grandmother who knows about the occult world',     'Action'),
      char('Vaux',             'Other',  'Antagonist',  'None',   'Alien entity with a grudge against Okarun',                'Action'),
    ]],

    snafuSNAFU: ['My Teen Romantic Comedy SNAFU', 'Romance', [
      char('Hachiman Hikigaya', 'Male',   'Protagonist', 'Brown',  'Cynical loner who uses self-sacrifice to solve social problems','Romance'),
      char('Yukino Yukinoshita','Female', 'Protagonist', 'Black',  'Ice-cold perfectionist who hides her vulnerabilities',       'Romance'),
      char('Yui Yuigahama',    'Female', 'Supporting',  'Brown',  'Bubbly and empathetic; struggles between her two friends',  'Romance'),
      char('Saika Totsuka',    'Male',   'Supporting',  'Brown',  'Gentle tennis club member who befriends Hachiman warmly',   'Romance'),
      char('Shizuka Hiratsuka','Female', 'Supporting',  'Black',  'Service Club advisor who pushes Hachiman toward growth',    'Romance'),
      char('Hayato Hayama',    'Male',   'Supporting',  'Blonde', 'Popular class leader who maintains peace at personal cost', 'Romance'),
      char('Haruno Yukinoshita','Female','Supporting',  'Black',  'Yukino\'s overbearing and manipulative older sister',      'Romance'),
      char('Iroha Isshiki',    'Female', 'Supporting',  'Brown',  'Student council president who uses Hachiman as a tool',    'Romance'),
      char('Saki Kawasaki',    'Female', 'Supporting',  'Black',  'Delinquent-looking girl with a caring side for her siblings','Romance'),
      char('Yoshiteru Zaimokuza','Male', 'Supporting',  'Brown',  'Chuunibyou self-styled warrior who asks the club for help', 'Romance'),
    ]],

    classroomElite: ['Classroom of the Elite', 'Other', [
      char('Kiyotaka Ayanokoji','Male',  'Protagonist', 'Brown',  'Conceals his genius while perfectly manipulating events',    'Other'),
      char('Suzune Horikita',  'Female', 'Supporting',  'Black',  'Proud perfectionist determined to reach Class A alone',     'Other'),
      char('Kikyou Kushida',   'Female', 'Supporting',  'Brown',  'Beloved social butterfly hiding a vindictive dark side',    'Other'),
      char('Airi Sakura',      'Female', 'Supporting',  'Brown',  'Shy amateur photographer with a secret online identity',    'Other'),
      char('Ken Sudo',         'Male',   'Supporting',  'Black',  'Hot-headed basketball player who struggles academically',   'Other'),
      char('Rokusuke Koenji',  'Male',   'Supporting',  'Silver', 'Flamboyant narcissist with exceptional hidden abilities',   'Other'),
      char('Kakeru Ryuen',     'Male',   'Antagonist',  'Silver', 'Class C leader who rules through fear and calculated violence','Other'),
      char('Arisu Sakayanagi', 'Female', 'Antagonist',  'Blonde', 'Class A leader who engineers tests to expose Ayanokoji',   'Other'),
      char('Sae Chabashira',   'Female', 'Supporting',  'Brown',  'Class D homeroom teacher who knows Ayanokoji\'s origin',   'Other'),
    ]],

    vermeil: ['Vermeil in Gold', 'Action', [
      char('Alto Goldfield', 'Male',   'Protagonist', 'Brown',  'Struggling mage student who accidentally summons Vermeil',  'Action'),
      char('Vermeil',        'Female', 'Protagonist', 'Red',    'Ancient and immensely powerful demon bound to Alto',         'Action'),
      char('Lilia Kudelfate','Female', 'Supporting',  'Blonde', 'Alto\'s childhood friend and gifted rival mage',             'Action'),
      char('Chris Blanche',  'Male',   'Supporting',  'Blonde', 'Alto\'s supportive friend at the magic academy',             'Action'),
      char('Obsidian',       'Female', 'Supporting',  'Black',  'Powerful demon who knows Vermeil from the past',             'Action'),
    ]],

    cafeTerrace: ['The Café Terrace and Its Goddesses', 'Romance', [
      char('Hayato Kasugano', 'Male',   'Protagonist', 'Brown',  'Inherits his late grandmother\'s seaside café against his will','Romance'),
      char('Shiragiku Ono',   'Female', 'Supporting',  'White',  'Quiet and mysterious café waitress with a calm demeanor',    'Romance'),
      char('Riho Tsukishima', 'Female', 'Supporting',  'Brown',  'Athletic and energetic café waitress',                       'Romance'),
      char('Akane Hououji',   'Female', 'Supporting',  'Pink',   'Idol-aspiring bubbly waitress full of energy',               'Romance'),
      char('Ami Tsurara',     'Female', 'Supporting',  'Blue',   'Carefree gyaru waitress who loves to relax',                 'Romance'),
      char('Ouka Makuzawa',   'Female', 'Supporting',  'Red',    'Tsundere waitress who reluctantly warms to Hayato',          'Romance'),
    ]],

    hokkaido: ['Hokkaido Gals Are Super Adorable!', 'Romance', [
      char('Shinichi Kitajima','Male',   'Protagonist', 'Brown', 'Tokyo transplant adjusting to Hokkaido\'s cold and culture', 'Romance'),
      char('Minami Fuyuki',   'Female', 'Protagonist', 'Brown', 'Energetic and warm-hearted Hokkaido gyaru',                  'Romance'),
      char('Sayuri Akino',    'Female', 'Supporting',  'Brown', 'Minami\'s calm and levelheaded best friend',                 'Romance'),
      char('Yukie Shiki',     'Female', 'Supporting',  'Brown', 'Minami\'s bespectacled studious friend',                     'Romance'),
      char('Tsubasa Shiki',   'Male',   'Supporting',  'Brown', 'Yukie\'s protective older brother',                          'Romance'),
    ]],

    takamineSan: ['Please Put Them On, Takamine-san', 'Romance', [
      char('Yukari Takamine', 'Female', 'Protagonist', 'Brown', 'Stoic and elegant class queen who blackmails Juugo',         'Romance'),
      char('Juugo Oumi',      'Male',   'Protagonist', 'Brown', 'Ordinary student coerced into being Takamine\'s secret servant','Romance'),
    ]],

    // ── GAVIN ONLY ────────────────────────────────────────────────────────────

    komi: ['Komi Can\'t Communicate', 'Romance', [
      char('Shouko Komi',      'Female', 'Protagonist', 'Black',  'Beautiful girl with crippling communication disorder; wants 100 friends','Romance'),
      char('Hitohito Tadano',  'Male',   'Protagonist', 'Brown',  'Ordinary boy who can read the room and helps Komi connect','Romance'),
      char('Najimi Osana',     'Other',  'Supporting',  'Brown',  'Childhood friend of the entire class; gender ambiguous',   'Romance'),
      char('Ren Yamai',        'Female', 'Supporting',  'Brown',  'Yandere-level obsession with Komi',                        'Romance'),
      char('Makeru Yadano',    'Female', 'Supporting',  'Brown',  'Competitive girl who turns everything into a contest',     'Romance'),
      char('Omoharu Nakanaka', 'Female', 'Supporting',  'Brown',  'Chuunibyou girl who believes she is destined for greatness','Romance'),
      char('Himiko Agari',     'Female', 'Supporting',  'Brown',  'Dog-like personality; incredibly shy around strangers',    'Romance'),
    ]],

    eigtyySix: ['86 Eighty-Six', 'Sci-Fi', [
      char('Shinei Nouzen',      'Male',   'Protagonist', 'Silver', 'Reaper who hears the dying voices of his fallen comrades','Sci-Fi'),
      char('Vladilena Milizé',   'Female', 'Supporting',  'Silver', 'Handler who refuses to see the 86 as anything less than human','Sci-Fi'),
      char('Raiden Shuga',       'Male',   'Supporting',  'Black',  'Shin\'s second-in-command; cool-headed heavy gunner',    'Sci-Fi'),
      char('Theoto Rikka',       'Male',   'Supporting',  'Black',  'Scavenger who paints the names of the fallen on their units','Sci-Fi'),
      char('Anju Emma',          'Female', 'Supporting',  'Silver', 'Gentle gunner devastated by the death of her loved ones','Sci-Fi'),
      char('Kurena Kukumila',    'Female', 'Supporting',  'Blonde', 'Sniper who fights to protect Shin',                      'Sci-Fi'),
      char('Frederica Rosenfort','Female', 'Supporting',  'Brown',  'Former Empress of Giad who seeks to save Kiriya',        'Sci-Fi'),
      char('Ernst Zimmermann',   'Male',   'Supporting',  'Gray',   'Federal Republic president who gives the 86 a new home', 'Sci-Fi'),
    ]],

    // ── GABE ONLY ─────────────────────────────────────────────────────────────

    horimiya: ['Horimiya', 'Romance', [
      char('Kyouko Hori',    'Male',   'Protagonist', 'Brown',  'Popular girl at school who is a diligent homemaker at home','Romance'),
      char('Izumi Miyamura', 'Male',   'Protagonist', 'Black',  'Hidden tattoos and piercings beneath his quiet school facade','Romance'),
      char('Yuki Yoshikawa', 'Female', 'Supporting',  'Blonde', 'Hori\'s bubbly and cheerful best friend',                   'Romance'),
      char('Tooru Ishikawa', 'Male',   'Supporting',  'Brown',  'Had feelings for Hori; becomes one of Miyamura\'s friends', 'Romance'),
      char('Remi Ayasaki',   'Female', 'Supporting',  'Pink',   'Ishikawa\'s girlfriend and the student council secretary', 'Romance'),
      char('Kakeru Sengoku', 'Male',   'Supporting',  'Brown',  'Student council president who dates Remi',                  'Romance'),
      char('Sota Hori',      'Male',   'Supporting',  'Brown',  'Hori\'s adorable little brother who adores Miyamura',       'Romance'),
    ]],

    yourLieApril: ['Your Lie in April', 'Romance', [
      char('Kousei Arima',   'Male',   'Protagonist', 'Brown',  'Piano prodigy who cannot hear his own playing after trauma', 'Romance'),
      char('Kaori Miyazono', 'Female', 'Protagonist', 'Blonde', 'Free-spirited violinist who pulls Kousei back to music',     'Romance'),
      char('Tsubaki Sawabe', 'Female', 'Supporting',  'Brown',  'Kousei\'s softball-playing childhood friend who loves him',  'Romance'),
      char('Ryouta Watari',  'Male',   'Supporting',  'Brown',  'Soccer star and Kaori\'s declared "boyfriend"',             'Romance'),
      char('Hiroko Seto',    'Female', 'Supporting',  'Brown',  'Kousei\'s energetic and encouraging piano teacher',         'Romance'),
      char('Takeshi Aiza',   'Male',   'Supporting',  'Brown',  'Kousei\'s fiercely competitive rival pianist',              'Romance'),
      char('Nagi Aiza',      'Female', 'Supporting',  'Brown',  'Takeshi\'s younger sister who challenges Kousei to perform','Romance'),
    ]],

    coupleCuckoos: ['Couple of Cuckoos', 'Romance', [
      char('Nagi Umino',        'Male',   'Protagonist', 'Black',  'Diligent student who discovers he was switched at birth',   'Romance'),
      char('Erika Amano',       'Female', 'Protagonist', 'Blonde', 'Popular internet celebrity who was switched with Nagi',    'Romance'),
      char('Hiro Segawa',       'Female', 'Supporting',  'Brown',  'Nagi\'s biological sister who is also his classmate',      'Romance'),
      char('Sachi Umino',       'Female', 'Supporting',  'Brown',  'Erika\'s biological sister who is earnest and thoughtful', 'Romance'),
      char('Souichirou Tanigawa','Male',  'Supporting',  'Brown',  'Nagi\'s best friend who supports him through the chaos',   'Romance'),
    ]],
  };

  // ─── PLAYER PROFILES ─────────────────────────────────────────────────────────

  const buildAnimeList = (keys) => keys.map(key => {
    const [title, _genre, characters] = ANIME[key];
    return {
      id: uid(),
      title,
      characters: characters.map(c => ({ ...c, series: title })),
    };
  });

  const SEED = {
    caden: {
      id: 'caden', name: 'Caden',
      animeList: buildAnimeList([
        'dxd', 'quintuplets', 'bunnyGirl', 'ditf', 'moreThanMarried',
        'jjk', 'soloLeveling', 'sao', 'alya', 'charlotte',
        'blueLock', 'seraphEnd', 'deathNote', 'angelBeats', 'akameGaKill',
        'classroomElite', 'dressingDarling', 'rezero', 'blueBox', 'chainsawMan',
        'takamineSan', 'konosuba', 'callOfNight', 'codeGeass', 'angelNextDoor',
        'fireForce', 'shiunji', 'mushokuTensei', 'hsotd', 'snafuSNAFU',
        'chivalry', 'hundredGirlfriends', 'tensura', 'demonSlayer', 'vermeil',
        'cafeTerrace', 'dateALive', 'aot', 'trinitySeven', 'fate',
        'edgerunners', 'fragrantFlower', 'oshinoko', 'danDaDan', 'tokyoGhoul',
        'vinlandSaga', 'hokkaido', 'prisonSchool', 'testament', 'narutoFull',
        'erased', 'shikimori', 'midnightHeart',
      ]),
    },

    gavin: {
      id: 'gavin', name: 'Gavin',
      animeList: buildAnimeList([
        // Naruto original — uses the same show but a narrower key. We reuse
        // narutoFull but flag it; for gameplay purposes characters are the same.
        'narutoFull',
        'hsotd', 'dxd', 'chainsawMan', 'quintuplets', 'jjk', 'sao',
        'blueLock', 'blueBox', 'shiunji', 'moreThanMarried',
        'hundredGirlfriends', 'alya', 'charlotte', 'bunnyGirl',
        'chivalry', 'akameGaKill', 'mushokuTensei', 'angelBeats',
        'demonSlayer', 'komi', 'fragrantFlower', 'oshinoko', 'eigtyySix',
      ]),
    },

    gabe: {
      id: 'gabe', name: 'Gabe',
      animeList: buildAnimeList([
        'moreThanMarried', 'dressingDarling', 'shiunji', 'horimiya',
        'quintuplets', 'bunnyGirl', 'alya', 'angelNextDoor', 'jjk',
        'fragrantFlower', 'yourLieApril', 'oshinoko', 'callOfNight',
        'chainsawMan', 'akameGaKill', 'aot', 'rezero', 'coupleCuckoos',
        'mushokuTensei', 'ditf', 'soloLeveling', 'blueLock',
      ]),
    },

    liam: {
      id: 'liam', name: 'Liam',
      animeList: buildAnimeList([
        'moreThanMarried', 'chainsawMan', 'chivalry', 'quintuplets',
        'blueLock', 'jjk', 'alya',
      ]),
    },
  };

  // ─── MERGE LOGIC ─────────────────────────────────────────────────────────────

  let existing = {};
  try {
    existing = JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}');
    // eslint-disable-next-line no-unused-vars
  } catch (_e) {
    existing = {};
  }

  let addedAnime = 0;
  let addedChars = 0;

  for (const [key, seedProfile] of Object.entries(SEED)) {
    if (!existing[key]) {
      existing[key] = seedProfile;
      addedAnime += seedProfile.animeList.length;
      seedProfile.animeList.forEach(a => addedChars += a.characters.length);
    } else {
      for (const seedAnime of seedProfile.animeList) {
        const already = existing[key].animeList.find(
          a => a.title.toLowerCase() === seedAnime.title.toLowerCase()
        );
        if (!already) {
          existing[key].animeList.push(seedAnime);
          addedAnime++;
          addedChars += seedAnime.characters.length;
        } else {
          // Merge missing characters into existing anime entry
          for (const seedChar of seedAnime.characters) {
            const charExists = already.characters.find(
              c => c.name.toLowerCase() === seedChar.name.toLowerCase()
            );
            if (!charExists) {
              already.characters.push({ ...seedChar, series: already.title });
              addedChars++;
            }
          }
        }
      }
    }
  }

  localStorage.setItem(PROFILES_KEY, JSON.stringify(existing));

  console.log('%c✅ AniGuess seed complete!', 'color: #a855f7; font-weight: bold; font-size: 14px;');
  console.log(`   Added ${addedAnime} anime entries and ${addedChars} characters.`);
  console.log('   Refresh the page to see the data.');
})();
