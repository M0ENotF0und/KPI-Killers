/* data.js - sample catalogue, cost rates and small storage helpers.
   Everything lives in the browser (localStorage) for now.
   Later we swap these helpers for calls to the real backend/database. */

/* ----- storage helpers ----- */
function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function save(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
function esc(text){            // stops user text from being read as HTML
  const d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
}
function kes(n){ return 'KES ' + Math.round(n).toLocaleString('en-KE'); }

/* ----- labels used across the site ----- */
const CATEGORY_LABELS = {
  laptop:'Laptop', tablet:'Tablet', phone:'Phone', desktop:'Desktop / mini PC', monitor:'Monitor',
  office:'Office hardware', audio:'Headphones', storage:'External storage', mouse:'Mouse', keyboard:'Keyboard'
};
const ROLE_LABELS = { student:'Student', business:'Business buyer', consumer:'Everyday consumer' };
const TAG_LABELS = { light:'light weight', screen:'big / quality screen', battery:'long battery', ergonomic:'ergonomic design', noise:'noise cancelling' };
const COMPUTE = ['laptop', 'tablet', 'phone', 'desktop'];   // devices that have an OS and a workload level

/* ----- the "recommendation engine" profiles -----
   Picking a course (students), department (business) or main use (consumers) pre-fills a suggested
   workload and nudges the scoring. They never filter anything out on their own.
     workload: light | moderate | heavy      osLikes: soft OS preference
     tags: features that matter              use: matching "use" tags on products
     wantGpu / minRam: heavy-spec hints      software: things worth planning for (check licences) */
const COURSE_PROFILES = {
  'Computer Science / IT':        { brands:['Lenovo', 'ASUS', 'Dell', 'Apple'], workload:'heavy',    osLikes:['Linux','Windows'], tags:['battery'], use:['coding'], minRam:16,
    note:'Coding, virtual machines and containers love 16 GB+ of memory and a fast processor.',
    software:['Visual Studio Code','Git and GitHub','Docker Desktop','JetBrains IDEs (free student licence)'] },
  'Engineering':                  { brands:['ASUS', 'Lenovo', 'HP', 'Acer', 'MSI'], workload:'heavy',    osLikes:['Windows'], tags:['screen'], use:['engineering','gaming'], wantGpu:true, minRam:16,
    note:'CAD, simulation and MATLAB are demanding. Gaming-class or high-spec laptops with a dedicated GPU and 16 GB+ memory are the safe choice.',
    software:['AutoCAD','SolidWorks','MATLAB','ANSYS (check your university licences)'] },
  'Design / Architecture / Media':{ brands:['Apple', 'ASUS', 'Dell', 'HP'], workload:'heavy',    osLikes:['macOS','Windows'], tags:['screen'], use:['design'], wantGpu:true, minRam:16,
    note:'Creative and 3D tools need a strong processor, graphics and an accurate screen.',
    software:['Adobe Creative Cloud (student plan)','Figma','Blender (free)','DaVinci Resolve (free tier)'] },
  'Data Science / Mathematics':   { brands:['Lenovo', 'Apple', 'ASUS'], workload:'heavy',    osLikes:['Linux','macOS'], tags:['battery'], use:['coding','engineering'], minRam:16,
    note:'Data work needs plenty of memory and a strong processor for models and notebooks.',
    software:['Python with Anaconda','Jupyter','R and RStudio','MATLAB'] },
  'Medicine / Health Sciences':   { brands:['Apple', 'Lenovo', 'HP'], workload:'moderate', osLikes:[], tags:['battery','light'], use:['study'],
    note:'Mostly notes, slides and research, so battery life and portability come first.',
    software:['Anki','Zotero','Microsoft 365 or OneNote','Notion'] },
  'Business / Commerce / Accounting': { brands:['HP', 'Lenovo', 'Dell'], workload:'moderate', osLikes:['Windows'], tags:['battery'], use:['business','study'],
    note:'Excel-heavy work is smoothest on Windows.',
    software:['Microsoft 365 (Excel)','Power BI Desktop (free)','Zotero'] },
  'Law / Humanities / Education': { brands:['Apple', 'HP', 'Lenovo'], workload:'light',    osLikes:[], tags:['light','battery'], use:['study'],
    note:'Reading and writing all day, so light weight and long battery win.',
    software:['Microsoft 365 or Google Workspace','Zotero','Grammarly (free tier)'] }
};
const DEPT_PROFILES = {
  'Finance & Accounting':     { brands:['HP', 'Dell', 'Lenovo'], workload:'moderate', osLikes:['Windows'], tags:['screen','ergonomic'], use:['business'],
    note:'Spreadsheet work: a big screen and Windows compatibility help.', software:['Microsoft 365 (Excel)','Accounting software such as QuickBooks or Sage'] },
  'Sales & Marketing':        { brands:['Apple', 'Lenovo', 'HP'], workload:'moderate', osLikes:[], tags:['light','battery'], use:['business','portable'],
    note:'Mobile teams do best with light, long-battery devices.', software:['A CRM such as HubSpot or Zoho','Microsoft 365 or Google Workspace','Canva'] },
  'HR & Administration':      { brands:['HP', 'Dell'], workload:'light',    osLikes:['Windows'], tags:['ergonomic'], use:['business'],
    note:'Documents, email and printing. Reliable and comfortable beats powerful.', software:['Microsoft 365 or Google Workspace','HR / payroll system'] },
  'IT & Software':            { brands:['Lenovo', 'Dell', 'Apple'], workload:'heavy',    osLikes:['Linux','Windows'], tags:['screen'], use:['coding'], minRam:16,
    note:'Development and testing need strong specs and screen space.', software:['Visual Studio Code','Docker Desktop','Virtual machine tools'] },
  'Design & Media':           { brands:['Apple', 'ASUS'], workload:'heavy',    osLikes:['macOS'], tags:['screen'], use:['design'], wantGpu:true, minRam:16,
    note:'Creative work needs strong specs, graphics and a good display.', software:['Adobe Creative Cloud','Figma','DaVinci Resolve'] },
  'Operations & Logistics':   { brands:['HP', 'Dell'], workload:'light',    osLikes:['Windows'], tags:['ergonomic'], use:['business'],
    note:'Everyday admin, tracking and inventory software.', software:['Spreadsheets','Inventory or ERP software'] },
  'Customer Service':         { brands:['HP', 'Lenovo', 'Dell'], workload:'light',    osLikes:[], tags:['ergonomic','noise'], use:['business'],
    note:'Long hours on calls: comfort and good audio matter most.', software:['Helpdesk software such as Zendesk','Softphone or Teams / Zoom'] },
  'Management / Executive':   { brands:['Apple', 'Lenovo', 'Dell'], workload:'moderate', osLikes:[], tags:['light','battery'], use:['business','portable'],
    note:'Portable, dependable devices for meetings and travel.', software:['Microsoft 365','Teams or Zoom'] }
};
const CONSUMER_PROFILES = {
  'Everyday browsing & streaming': { brands:['Lenovo', 'HP', 'Samsung', 'Apple'], workload:'light',    osLikes:[], tags:['battery','light'], use:['everyday'],
    note:'Browsing, video and social media need very little power, so spend on battery and comfort.', software:['A modern browser','LibreOffice (free) or Google Workspace'] },
  'Working from home':             { brands:['Lenovo', 'HP', 'Apple'], workload:'moderate', osLikes:[], tags:['battery','ergonomic'], use:['business','everyday'], minRam:8,
    note:'Video calls and documents all day: reliable performance and comfortable accessories.', software:['Microsoft 365 or Google Workspace','Zoom or Teams'] },
  'Gaming':                        { brands:['ASUS', 'Lenovo', 'MSI', 'Acer'], workload:'heavy',    osLikes:['Windows'], tags:['screen'], use:['gaming'], wantGpu:true, minRam:16,
    note:'Games need a dedicated graphics card, 16 GB memory and a fast screen.', software:['Steam','Epic Games Launcher'] },
  'Creative (photo & video)':      { brands:['Apple', 'ASUS', 'Dell'], workload:'heavy',    osLikes:['macOS','Windows'], tags:['screen'], use:['design'], wantGpu:true, minRam:16,
    note:'Editing needs a strong processor, graphics and an accurate screen.', software:['DaVinci Resolve (free tier)','GIMP and Darktable (free)','Adobe Creative Cloud'] }
};

/* ----- sample catalogue (prices in KES, SAMPLE VALUES AND SPECS - the real catalogue comes from the backend API) -----
   tier: 1 = light work, 2 = moderate, 3 = heavy (only used for laptop/tablet/phone/desktop)
   tags: light | screen | battery | ergonomic | noise     use: study | coding | engineering | design | gaming | business | everyday | portable
   kg:   shipping weight, used for freight from Dubai */

function laptop(o){   // builds a laptop with a consistent spec list
  const storageText = (o.st >= 1024 ? (o.st / 1024) + ' TB' : o.st + ' GB') + ' ' + o.stt;
  return { id:o.id, brand:o.brand, model:o.model, name:o.brand + ' ' + o.model, category:'laptop', os:o.os, tier:o.tier,
    tags:o.tags, use:o.use, description:o.desc, cpu:o.cpu, ramGB:o.ram, ramType:o.rt, batteryWh:o.wh, dgpu:!!o.dg, gpu:o.gpu,
    storage:o.st, local:o.local, dubai:o.dubai, kg:o.w + 0.8, stock:o.stock,
    specs:{ 'Processor':o.cpu, 'Memory':o.ram + ' GB ' + o.rt, 'Storage':storageText, 'Graphics':o.gpu,
            'Battery':o.wh + ' Wh', 'Display':o.disp, 'Weight':o.w + ' kg' } };
}
function gear(o){     // everything else: specs are written out as [label, value] pairs
  return { id:o.id, brand:o.brand, model:o.model, name:o.brand + ' ' + o.model, category:o.category, os:o.os || 'Any', tier:o.tier || 1,
    tags:o.tags || [], use:o.use || [], description:o.desc, cpu:o.cpu || '', ramGB:o.ram || 0, ramType:o.rt || '', batteryWh:o.wh || 0,
    dgpu:false, gpu:'', storage:o.st || 0, local:o.local, dubai:o.dubai, kg:o.kg, stock:o.stock,
    specs:Object.fromEntries(o.specs) };
}

const DEFAULT_CATALOG = [
  // ---- everyday and portable laptops ----
  laptop({ id:1, brand:'Lenovo', model:'IdeaPad Slim 3 15', os:'Windows', tier:1, cpu:'Intel Core i5-1335U', ram:16, rt:'DDR4', st:512, stt:'NVMe SSD', gpu:'Intel Iris Xe (integrated)', wh:47, disp:'15.6" FHD IPS', w:1.6,
    tags:['light','battery'], use:['study','everyday'], local:62000, dubai:51000, stock:14, desc:'A light, affordable all-rounder for notes, research and video calls.' }),
  laptop({ id:2, brand:'HP', model:'15-fd Core i5', os:'Windows', tier:2, cpu:'Intel Core i5-1335U', ram:16, rt:'DDR4', st:512, stt:'NVMe SSD', gpu:'Intel Iris Xe (integrated)', wh:41, disp:'15.6" FHD', w:1.6,
    tags:['screen'], use:['study','business'], local:78000, dubai:64000, stock:9, desc:'A dependable office and study laptop with a full-size keyboard.' }),
  laptop({ id:3, brand:'ASUS', model:'Vivobook 16', os:'Windows', tier:2, cpu:'AMD Ryzen 7 7730U', ram:16, rt:'DDR4', st:1024, stt:'NVMe SSD', gpu:'AMD Radeon (integrated)', wh:50, disp:'16" WUXGA', w:1.9,
    tags:['screen','battery'], use:['study','business','coding'], local:95000, dubai:79000, stock:6, desc:'A big screen and 1 TB of storage at a mid-range price.' }),
  laptop({ id:4, brand:'ASUS', model:'Zenbook 14 OLED', os:'Windows', tier:3, cpu:'Intel Core Ultra 7 155H', ram:16, rt:'LPDDR5X', st:1024, stt:'NVMe SSD', gpu:'Intel Arc (integrated)', wh:75, disp:'14" 2.8K OLED', w:1.2,
    tags:['light','battery','screen'], use:['design','coding','portable','study'], local:165000, dubai:138000, stock:5, desc:'A premium ultraportable: very light, a vivid OLED screen and a large 75 Wh battery.' }),
  laptop({ id:5, brand:'Lenovo', model:'ThinkPad E14 Gen 5', os:'Windows', tier:2, cpu:'Intel Core i5-1335U', ram:16, rt:'DDR4', st:512, stt:'NVMe SSD', gpu:'Intel Iris Xe (integrated)', wh:47, disp:'14" FHD IPS', w:1.4,
    tags:['battery','light'], use:['business','study'], local:105000, dubai:88000, stock:8, desc:'A business-grade laptop with a great keyboard and strong build.' }),
  laptop({ id:6, brand:'Dell', model:'Inspiron 14 Plus', os:'Windows', tier:3, cpu:'Intel Core Ultra 7 155H', ram:16, rt:'LPDDR5X', st:1024, stt:'NVMe SSD', gpu:'Intel Arc (integrated)', wh:64, disp:'14" 2.2K', w:1.6,
    tags:['light','screen'], use:['coding','design','study'], local:142000, dubai:118000, stock:4, desc:'Strong everyday performance with a sharp screen, without gaming-laptop bulk.' }),
  laptop({ id:7, brand:'Apple', model:'MacBook Air 13 (M2)', os:'macOS', tier:2, cpu:'Apple M2 (8-core)', ram:8, rt:'unified memory', st:256, stt:'SSD', gpu:'Apple 8-core GPU (integrated)', wh:52.6, disp:'13.6" Liquid Retina', w:1.24,
    tags:['light','battery'], use:['study','design','portable'], local:135000, dubai:112000, stock:5, desc:'Silent, light and long-lasting: the easy choice for students on macOS.' }),
  laptop({ id:8, brand:'Apple', model:'MacBook Pro 14 (M3)', os:'macOS', tier:3, cpu:'Apple M3 (8-core)', ram:16, rt:'unified memory', st:512, stt:'SSD', gpu:'Apple 10-core GPU (integrated)', wh:70, disp:'14.2" Liquid Retina XDR', w:1.55,
    tags:['screen','battery'], use:['design','coding','portable'], local:255000, dubai:215000, stock:3, desc:'Top-tier screen and sustained performance for creative and development work.' }),
  laptop({ id:9, brand:'Lenovo', model:'ThinkPad T14 Gen 4 (Linux-ready)', os:'Linux', tier:2, cpu:'AMD Ryzen 7 PRO 7840U', ram:16, rt:'DDR5', st:512, stt:'NVMe SSD', gpu:'AMD Radeon 780M (integrated)', wh:52.5, disp:'14" WUXGA', w:1.4,
    tags:['battery','light'], use:['coding','engineering','business'], local:118000, dubai:98000, stock:7, desc:'Runs Linux out of the box. Great for developers who want a solid, portable machine.' }),
  // ---- gaming-class and high-spec laptops (engineering, design, gaming) ----
  laptop({ id:10, brand:'Acer', model:'Nitro V 15', os:'Windows', tier:3, cpu:'Intel Core i5-13420H', ram:16, rt:'DDR5', st:512, stt:'NVMe SSD', gpu:'NVIDIA GeForce RTX 4050 6 GB', dg:true, wh:57, disp:'15.6" FHD 144 Hz', w:2.1,
    tags:['screen'], use:['engineering','gaming'], local:120000, dubai:98000, stock:8, desc:'The budget way into a dedicated GPU: capable for CAD, light rendering and gaming.' }),
  laptop({ id:11, brand:'ASUS', model:'TUF Gaming A15', os:'Windows', tier:3, cpu:'AMD Ryzen 7 7735HS', ram:16, rt:'DDR5', st:512, stt:'NVMe SSD', gpu:'NVIDIA GeForce RTX 4050 6 GB', dg:true, wh:90, disp:'15.6" FHD 144 Hz', w:2.2,
    tags:['battery','screen'], use:['engineering','gaming','coding'], local:135000, dubai:112000, stock:6, desc:'Rugged and powerful, with a very large 90 Wh battery for a gaming-class laptop.' }),
  laptop({ id:12, brand:'HP', model:'Victus 16', os:'Windows', tier:3, cpu:'Intel Core i7-13700H', ram:16, rt:'DDR5', st:512, stt:'NVMe SSD', gpu:'NVIDIA GeForce RTX 4060 8 GB', dg:true, wh:83, disp:'16.1" FHD 144 Hz', w:2.3,
    tags:['screen','battery'], use:['engineering','gaming','design'], local:165000, dubai:136000, stock:5, desc:'A strong processor and RTX 4060 in a plain, school-friendly design.' }),
  laptop({ id:13, brand:'MSI', model:'Katana 15', os:'Windows', tier:3, cpu:'Intel Core i7-13620H', ram:16, rt:'DDR5', st:1024, stt:'NVMe SSD', gpu:'NVIDIA GeForce RTX 4060 8 GB', dg:true, wh:53.5, disp:'15.6" FHD 144 Hz', w:2.25,
    tags:['screen'], use:['engineering','gaming','design'], local:175000, dubai:145000, stock:4, desc:'1 TB of storage and an RTX 4060 for large CAD and rendering projects.' }),
  laptop({ id:14, brand:'Lenovo', model:'Legion 5 (15)', os:'Windows', tier:3, cpu:'AMD Ryzen 7 7840HS', ram:16, rt:'DDR5', st:1024, stt:'NVMe SSD', gpu:'NVIDIA GeForce RTX 4060 8 GB', dg:true, wh:80, disp:'15.6" WQHD 165 Hz', w:2.4,
    tags:['screen','battery'], use:['engineering','gaming','design','coding'], local:189000, dubai:156000, stock:5, desc:'Excellent cooling and a sharp WQHD screen: a favourite for engineering and gaming.' }),
  laptop({ id:15, brand:'ASUS', model:'ROG Strix G16', os:'Windows', tier:3, cpu:'Intel Core i9-13980HX', ram:32, rt:'DDR5', st:1024, stt:'NVMe SSD', gpu:'NVIDIA GeForce RTX 4070 8 GB', dg:true, wh:90, disp:'16" QHD+ 240 Hz', w:2.5,
    tags:['screen','battery'], use:['engineering','gaming','design'], local:285000, dubai:236000, stock:2, desc:'Workstation-level power: 32 GB DDR5 and an RTX 4070 for the heaviest engineering and creative work.' }),
  // ---- tablets ----
  gear({ id:16, brand:'Apple', model:'iPad (10th gen)', category:'tablet', os:'iOS', tier:1, cpu:'Apple A14 Bionic', ram:4, wh:28.6, st:256, tags:['light','battery'], use:['study','everyday'],
    local:62000, dubai:51000, kg:0.9, stock:10, desc:'A simple, reliable tablet for lecture notes with Apple Pencil support.',
    specs:[['Processor','Apple A14 Bionic'],['Memory','4 GB'],['Storage','256 GB'],['Battery','28.6 Wh'],['Display','10.9" Liquid Retina'],['Weight','0.48 kg']] }),
  gear({ id:17, brand:'Apple', model:'iPad Air 11 (M2)', category:'tablet', os:'iOS', tier:2, cpu:'Apple M2', ram:8, wh:28.9, st:256, tags:['light','battery','screen'], use:['study','design'],
    local:98000, dubai:82000, kg:0.9, stock:6, desc:'Laptop-class power for handwritten notes, PDFs and sketching.',
    specs:[['Processor','Apple M2'],['Memory','8 GB'],['Storage','256 GB'],['Battery','28.9 Wh'],['Display','11" Liquid Retina'],['Weight','0.46 kg']] }),
  gear({ id:18, brand:'Samsung', model:'Galaxy Tab S9 FE', category:'tablet', os:'Android', tier:1, cpu:'Exynos 1380', ram:6, wh:30.8, st:128, tags:['light','screen'], use:['study','everyday'],
    local:58000, dubai:47000, kg:0.9, stock:12, desc:'Comes with an S Pen in the box, so it is ready for note-taking straight away.',
    specs:[['Processor','Exynos 1380'],['Memory','6 GB'],['Storage','128 GB'],['Battery','30.8 Wh'],['Display','10.9" LCD, 90 Hz'],['Weight','0.52 kg']] }),
  gear({ id:19, brand:'Lenovo', model:'Tab M10 (3rd gen)', category:'tablet', os:'Android', tier:1, cpu:'Unisoc T610', ram:4, wh:19.7, st:128, tags:['light'], use:['everyday','study'],
    local:24000, dubai:19000, kg:0.8, stock:18, desc:'The budget pick for reading, video and basic note-taking.',
    specs:[['Processor','Unisoc T610'],['Memory','4 GB'],['Storage','128 GB'],['Battery','19.7 Wh'],['Display','10.1" HD'],['Weight','0.46 kg']] }),
  // ---- phones ----
  gear({ id:20, brand:'Xiaomi', model:'Redmi Note 13', category:'phone', os:'Android', tier:1, cpu:'Snapdragon 685', ram:6, wh:19.3, st:128, tags:['battery'], use:['everyday'],
    local:28000, dubai:23000, kg:0.7, stock:25, desc:'Great value: a bright AMOLED screen and a large battery for the price.',
    specs:[['Processor','Snapdragon 685'],['Memory','6 GB'],['Storage','128 GB'],['Battery','5,000 mAh (about 19 Wh)'],['Display','6.67" AMOLED, 120 Hz']] }),
  gear({ id:21, brand:'Samsung', model:'Galaxy A35', category:'phone', os:'Android', tier:2, cpu:'Exynos 1380', ram:6, wh:19.3, st:128, tags:['battery','screen'], use:['everyday','business'],
    local:38000, dubai:31000, kg:0.7, stock:16, desc:'A mid-range phone with long software support and a good camera.',
    specs:[['Processor','Exynos 1380'],['Memory','6 GB'],['Storage','128 GB'],['Battery','5,000 mAh (about 19 Wh)'],['Display','6.6" Super AMOLED, 120 Hz']] }),
  gear({ id:22, brand:'Samsung', model:'Galaxy S24', category:'phone', os:'Android', tier:3, cpu:'Snapdragon 8 Gen 3 for Galaxy', ram:8, wh:15.4, st:256, tags:['screen'], use:['everyday','design','business'],
    local:105000, dubai:88000, kg:0.7, stock:7, desc:'A flagship that stays fast for years, with a top-tier camera and screen.',
    specs:[['Processor','Snapdragon 8 Gen 3 for Galaxy'],['Memory','8 GB'],['Storage','256 GB'],['Battery','4,000 mAh (about 15 Wh)'],['Display','6.2" Dynamic AMOLED 2X, 120 Hz']] }),
  gear({ id:23, brand:'Apple', model:'iPhone 15', category:'phone', os:'iOS', tier:3, cpu:'Apple A16 Bionic', ram:6, wh:12.7, st:128, tags:['light'], use:['everyday','design','business'],
    local:118000, dubai:98000, kg:0.7, stock:9, desc:'Smooth, secure and well supported, with a very good camera.',
    specs:[['Processor','Apple A16 Bionic'],['Memory','6 GB'],['Storage','128 GB'],['Battery','3,349 mAh (about 12.7 Wh)'],['Display','6.1" Super Retina XDR']] }),
  // ---- desktops and mini PCs ----
  gear({ id:24, brand:'Beelink', model:'SER5 Mini PC (Linux-ready)', category:'desktop', os:'Linux', tier:1, cpu:'AMD Ryzen 5 5560U', ram:16, rt:'DDR4', st:512, tags:['light'], use:['everyday','coding'],
    local:55000, dubai:45000, kg:1.4, stock:5, desc:'Tiny, quiet and cheap to run: perfect for a home desk or light office tasks.',
    specs:[['Processor','AMD Ryzen 5 5560U'],['Memory','16 GB DDR4'],['Storage','512 GB NVMe SSD'],['Graphics','AMD Radeon (integrated)'],['Size','Mini PC, about 0.5 L']] }),
  gear({ id:25, brand:'ASUS', model:'ExpertCenter PN64 Mini PC', category:'desktop', os:'Windows', tier:1, cpu:'Intel Core i5-1335U', ram:16, rt:'DDR4', st:512, tags:['light'], use:['business','everyday'],
    local:65000, dubai:54000, kg:1.5, stock:8, desc:'A compact Windows PC for offices, reception desks and home working.',
    specs:[['Processor','Intel Core i5-1335U'],['Memory','16 GB DDR4'],['Storage','512 GB NVMe SSD'],['Graphics','Intel Iris Xe (integrated)'],['Size','Mini PC']] }),
  gear({ id:26, brand:'Apple', model:'Mac mini (M2)', category:'desktop', os:'macOS', tier:2, cpu:'Apple M2', ram:8, rt:'unified memory', st:256, tags:['light'], use:['design','business','everyday'],
    local:90000, dubai:75000, kg:1.9, stock:4, desc:'Small, silent and fast. You bring your own monitor, keyboard and mouse.',
    specs:[['Processor','Apple M2 (8-core)'],['Memory','8 GB unified memory'],['Storage','256 GB SSD'],['Graphics','Apple 10-core GPU (integrated)'],['Size','Mini PC, 1.18 kg']] }),
  gear({ id:27, brand:'HP', model:'Pro Mini 400 G9', category:'desktop', os:'Windows', tier:2, cpu:'Intel Core i5-13500T', ram:16, rt:'DDR5', st:512, tags:['light'], use:['business'],
    local:92000, dubai:76000, kg:2.2, stock:6, desc:'A business mini PC with strong security and easy upgrades.',
    specs:[['Processor','Intel Core i5-13500T'],['Memory','16 GB DDR5'],['Storage','512 GB NVMe SSD'],['Graphics','Intel UHD (integrated)'],['Size','Mini PC']] }),
  gear({ id:28, brand:'Dell', model:'OptiPlex Tower Plus 7010', category:'desktop', os:'Windows', tier:2, cpu:'Intel Core i5-13500', ram:16, rt:'DDR5', st:512, tags:[], use:['business'],
    local:98000, dubai:82000, kg:9.0, stock:10, desc:'A full-size office desktop that is easy to repair and upgrade.',
    specs:[['Processor','Intel Core i5-13500'],['Memory','16 GB DDR5'],['Storage','512 GB NVMe SSD'],['Graphics','Intel UHD (integrated)'],['Size','Tower']] }),
  gear({ id:29, brand:'Lenovo', model:'ThinkCentre neo 50t', category:'desktop', os:'Windows', tier:3, cpu:'Intel Core i7-13700', ram:32, rt:'DDR4', st:1024, tags:[], use:['business','coding','engineering'], wantGpu:false,
    local:128000, dubai:106000, kg:8.0, stock:5, desc:'32 GB of memory and a fast processor for heavy office, data and development work.',
    specs:[['Processor','Intel Core i7-13700'],['Memory','32 GB DDR4'],['Storage','1 TB NVMe SSD'],['Graphics','Intel UHD (integrated)'],['Size','Tower']] }),
  gear({ id:30, brand:'Lenovo', model:'Legion Tower 5', category:'desktop', os:'Windows', tier:3, cpu:'AMD Ryzen 7 7700', ram:16, rt:'DDR5', st:1024, tags:['screen'], use:['engineering','gaming','design'],
    local:215000, dubai:178000, kg:13.0, stock:3, desc:'A gaming-class tower with an RTX 4060 Ti for CAD, rendering and gaming at a desk.',
    specs:[['Processor','AMD Ryzen 7 7700'],['Memory','16 GB DDR5'],['Storage','1 TB NVMe SSD'],['Graphics','NVIDIA GeForce RTX 4060 Ti 8 GB'],['Size','Tower']] }),
  // ---- monitors ----
  gear({ id:31, brand:'HP', model:'P22 G5 22" Monitor', category:'monitor', tags:[], use:['business','everyday'], local:14500, dubai:11500, kg:3.5, stock:22,
    desc:'A simple, low-cost screen for office and home desks.', specs:[['Size','21.5"'],['Resolution','1920 x 1080 (FHD)'],['Panel','IPS'],['Refresh rate','75 Hz'],['Ports','HDMI, DisplayPort, VGA']] }),
  gear({ id:32, brand:'Dell', model:'P2425H 24" Monitor', category:'monitor', tags:['screen','ergonomic'], use:['business','study'], local:21500, dubai:16500, kg:5.0, stock:20,
    desc:'Height-adjustable and pivoting, so it is comfortable for long working days.', specs:[['Size','23.8"'],['Resolution','1920 x 1080 (FHD)'],['Panel','IPS'],['Refresh rate','100 Hz'],['Ergonomics','Height, tilt, swivel and pivot']] }),
  gear({ id:33, brand:'LG', model:'27UP850 27" 4K Monitor', category:'monitor', tags:['screen','ergonomic'], use:['design','engineering','business'], local:48000, dubai:39500, kg:7.5, stock:8,
    desc:'Sharp 4K detail and USB-C charging: a great second screen for design and engineering work.', specs:[['Size','27"'],['Resolution','3840 x 2160 (4K UHD)'],['Panel','IPS'],['Refresh rate','60 Hz'],['Ports','USB-C (96 W), HDMI, DisplayPort']] }),
  // ---- office hardware ----
  gear({ id:34, brand:'TP-Link', model:'ER605 Business Router', category:'office', tags:[], use:['business'], local:12500, dubai:9800, kg:1.0, stock:15,
    desc:'A small-office router that can combine several internet lines.', specs:[['Type','Wired VPN router'],['WAN ports','Up to 4 (load balancing)'],['Ports','Gigabit']] }),
  gear({ id:35, brand:'APC', model:'Back-UPS 650VA', category:'office', tags:[], use:['business','everyday'], local:9500, dubai:7200, kg:4.5, stock:20,
    desc:'Keeps a computer running through short power cuts so work is not lost.', specs:[['Type','UPS (battery backup)'],['Capacity','650 VA / 400 W'],['Outlets','4']] }),
  gear({ id:36, brand:'HP', model:'LaserJet Pro M111w Printer', category:'office', tags:['ergonomic'], use:['business','everyday'], local:18500, dubai:14500, kg:5.5, stock:12,
    desc:'A compact black-and-white laser printer with Wi-Fi. Cheap per page.', specs:[['Type','Mono laser printer'],['Speed','20 pages per minute'],['Connectivity','Wi-Fi, USB']] }),
  gear({ id:37, brand:'Epson', model:'EcoTank L3250 Printer', category:'office', tags:[], use:['business','everyday','study'], local:32000, dubai:26000, kg:5.0, stock:9,
    desc:'Refillable ink tanks keep colour printing costs low. Prints, scans and copies.', specs:[['Type','Colour ink-tank all-in-one'],['Functions','Print, scan, copy'],['Connectivity','Wi-Fi, USB']] }),
  gear({ id:38, brand:'Canon', model:'imageFORMULA R10 Scanner', category:'office', tags:[], use:['business'], local:28000, dubai:22500, kg:3.5, stock:4,
    desc:'A fast portable document scanner for digitising paperwork.', specs:[['Type','Sheet-fed document scanner'],['Speed','12 pages per minute'],['Connectivity','USB']] }),
  // ---- headphones ----
  gear({ id:39, brand:'JBL', model:'Tune 770NC', category:'audio', tags:['noise','battery','light'], use:['study','everyday'], wh:2, local:16500, dubai:13000, kg:0.6, stock:14,
    desc:'Affordable noise cancelling with a long battery life. A good library companion.', specs:[['Type','Over-ear, wireless'],['Noise cancelling','Active (ANC)'],['Battery','Up to 70 hours (ANC off)'],['Weight','0.23 kg']] }),
  gear({ id:40, brand:'Sony', model:'WH-1000XM5', category:'audio', tags:['noise','battery'], use:['study','business','everyday'], wh:2.5, local:48000, dubai:39000, kg:0.9, stock:6,
    desc:'Among the best noise cancelling available, and great for calls too.', specs:[['Type','Over-ear, wireless'],['Noise cancelling','Active (ANC), top class'],['Battery','Up to 30 hours (ANC on)'],['Weight','0.25 kg']] }),
  gear({ id:41, brand:'Jabra', model:'Evolve2 40 Headset', category:'audio', tags:['light','ergonomic','noise'], use:['business','study'], wh:1.5, local:19500, dubai:15500, kg:0.5, stock:2,
    desc:'Built for calls: clear microphone and a light, comfortable fit for all-day wear.', specs:[['Type','On-ear, wired/USB'],['Noise cancelling','Passive, with noise-reducing microphone'],['Weight','0.12 kg']] }),
  // ---- external storage ----
  gear({ id:42, brand:'SanDisk', model:'Extreme Portable SSD 500GB', category:'storage', st:512, tags:[], use:['study','everyday'], local:9500, dubai:7500, kg:0.2, stock:30,
    desc:'Fast, pocket-sized backup for assignments and projects.', specs:[['Capacity','500 GB'],['Type','Portable SSD'],['Speed','Up to 1,050 MB/s']] }),
  gear({ id:43, brand:'Samsung', model:'T7 Portable SSD 1TB', category:'storage', st:1024, tags:[], use:['study','design','coding'], local:14500, dubai:11500, kg:0.2, stock:18,
    desc:'1 TB of fast storage for projects, datasets and big files.', specs:[['Capacity','1 TB'],['Type','Portable SSD'],['Speed','Up to 1,050 MB/s']] }),
  gear({ id:44, brand:'WD', model:'My Passport 2TB', category:'storage', st:2048, tags:[], use:['study','everyday'], local:11500, dubai:9000, kg:0.3, stock:20,
    desc:'The cheapest way to store a lot: 2 TB of backup space.', specs:[['Capacity','2 TB'],['Type','Portable hard drive (HDD)'],['Speed','Up to about 130 MB/s']] }),
  // ---- mice ----
  gear({ id:45, brand:'Logitech', model:'M185 Wireless Mouse', category:'mouse', tags:['light'], use:['study','everyday'], local:1800, dubai:1300, kg:0.2, stock:40,
    desc:'A basic, light mouse that just works.', specs:[['Type','Wireless, standard'],['Connection','USB receiver'],['Battery','Up to 12 months (AA)']] }),
  gear({ id:46, brand:'Logitech', model:'Lift Ergonomic Mouse', category:'mouse', tags:['ergonomic'], use:['study','business'], local:9800, dubai:7800, kg:0.4, stock:15,
    desc:'A small vertical mouse that eases wrist strain, ideal for long study sessions.', specs:[['Type','Vertical ergonomic'],['Connection','Bluetooth or receiver'],['Battery','Up to 24 months (AA)']] }),
  gear({ id:47, brand:'Logitech', model:'MX Vertical', category:'mouse', tags:['ergonomic'], use:['business','design','coding'], local:12500, dubai:9800, kg:0.5, stock:10,
    desc:'A larger vertical mouse with a rechargeable battery and very precise tracking.', specs:[['Type','Vertical ergonomic'],['Connection','Bluetooth or receiver'],['Battery','Rechargeable, up to 4 months']] }),
  // ---- keyboards ----
  gear({ id:48, brand:'Logitech', model:'K380 Multi-Device Keyboard', category:'keyboard', tags:['light'], use:['study','everyday'], local:5500, dubai:4200, kg:0.6, stock:25,
    desc:'A slim keyboard that pairs with a tablet, phone and laptop at once.', specs:[['Type','Compact wireless'],['Connection','Bluetooth (3 devices)'],['Battery','Up to 24 months (AAA)']] }),
  gear({ id:49, brand:'Logitech', model:'MX Keys', category:'keyboard', tags:['ergonomic'], use:['business','coding','design'], local:14500, dubai:11500, kg:1.0, stock:11,
    desc:'Comfortable, quiet keys with backlighting for long typing days.', specs:[['Type','Full-size wireless, backlit'],['Connection','Bluetooth or receiver'],['Battery','Rechargeable, up to 10 days (5 months backlight off)']] }),
  gear({ id:50, brand:'Logitech', model:'Ergo K860', category:'keyboard', tags:['ergonomic'], use:['business','study'], local:16500, dubai:13500, kg:1.4, stock:7,
    desc:'A split, curved layout with a wrist rest to reduce strain.', specs:[['Type','Split ergonomic wireless'],['Connection','Bluetooth or receiver'],['Battery','Up to 24 months (AAA)']] })
];

/* Import cost rates. PLACEHOLDERS - check the current KRA/EAC rates before we rely on these. */
const DEFAULT_RATES = { freightPerKg: 600, dutyPct: 0, vatPct: 16 };

/* "_v3": new catalogue shape (brand, model, specs). Older saved test data is ignored. */
const CATALOG_KEY = 'itr_catalog_v3';
function getCatalog(){ return load(CATALOG_KEY, DEFAULT_CATALOG); }
function getRates(){   return load('itr_rates', DEFAULT_RATES); }
function getBrands(category){
  return Array.from(new Set(getCatalog().filter(i => !category || i.category === category).map(i => i.brand))).sort();
}

/* Landed cost of buying from Dubai: price + freight + duty + VAT */
function dubaiLanded(item){
  const r = getRates();
  const price   = item.dubai;
  const freight = item.kg * r.freightPerKg;
  const duty    = price * r.dutyPct / 100;
  const vat     = (price + freight + duty) * r.vatPct / 100;
  return { price, freight, duty, vat, total: price + freight + duty + vat };
}
/* labels used by the cards (render.js) and the browse page */
const TYPE_LABELS = { everyday:'Everyday', business:'Business', ultrabook:'Ultrabook', creator:'Creator', gaming:'Gaming',
                      workstation:'Workstation', mini:'Mini PC', tower:'Tower', 'all-in-one':'All-in-one' };
const USE_LABELS = { study:'Study & note-taking', coding:'Coding', engineering:'Engineering & simulation', design:'Design & creative work',
                     gaming:'Gaming', business:'Office & business', everyday:'Everyday use', portable:'Travel & portability' };

function typeOf(i){
  if(i.category === 'laptop'){
    if(i.dgpu && i.ramGB >= 32) return 'workstation';
    if(i.dgpu) return 'gaming';
    if(i.use.includes('design') && i.tier === 3) return 'creator';
    if(i.tags.includes('light') && i.tier >= 2) return 'ultrabook';
    if(i.use.includes('business')) return 'business';
    return 'everyday';
  }
  if(i.category === 'desktop') return i.kg < 3 ? 'mini' : 'tower';
  return '';
}

/* the product shape the whole front end uses (same as docs/API.md): adds type, useCases and landed */
function toProduct(item){
  return Object.assign({}, item, {
    type: typeOf(item),
    useCases: (item.use || []).map(u => USE_LABELS[u] || u),
    landed: dubaiLanded(item)
  });
}
const routeOf = item => item.local <= dubaiLanded(item).total ? 'Local' : 'Dubai';

/* which profile applies to this scenario */
function profileFor(s){
  if(s.role === 'student')  return COURSE_PROFILES[s.course] || null;
  if(s.role === 'business') return DEPT_PROFILES[s.department] || null;
  if(s.role === 'consumer') return CONSUMER_PROFILES[s.usecase] || null;
  return null;
}

/* ----- the recommendation engine (simple scoring, easy to improve later) -----
   Hard rules (filter out): wrong category, out of stock, over budget, too weak for the workload,
   or a specific OS chosen that does not match.
   Soft scoring (changes the order only): preferred brands, comfort tags, storage, and the course /
   department / use profile. Engineering students get gaming-class and workstation laptops boosted.
   Variety: at most 2 products per brand, up to 6 picks. */
function recommendPicks(s){
  const need = { light:1, moderate:2, heavy:3 }[s.workload] || 1;
  const profile = profileFor(s);
  const brands = s.brands || [];
  const fullBudget = s.fullBudget || s.budget;
  const scored = [];

  for(const item of getCatalog()){
    if(item.category !== s.category || item.stock <= 0) continue;
    const isCompute = COMPUTE.includes(item.category);
    const landed = dubaiLanded(item);
    const cheapest = Math.min(item.local, landed.total);
    if(cheapest > s.budget) continue;                                  // over budget
    if(isCompute && item.tier < need) continue;                        // too weak for the workload
    if(isCompute && s.os !== 'any' && item.os !== s.os) continue;      // OS chosen but different

    let score = 50;
    const brandMatch = brands.includes(item.brand);
    if(brandMatch) score += 25;                                        // preferred brand
    if(isCompute && s.os !== 'any') score += 15;
    if(s.storage > 0 && (isCompute || item.category === 'storage')) score += item.storage >= s.storage ? 10 : -10;
    for(const want of s.ergo) if(item.tags.includes(want)) score += 8;
    if(profile){
      for(const t of profile.tags) if(item.tags.includes(t)) score += 5;
      for(const u of (profile.use || [])) if(item.use.includes(u)) score += 6;
      if(isCompute && s.os === 'any' && profile.osLikes.includes(item.os)) score += 8;
      if(profile.wantGpu && item.dgpu) score += 18;
      if(profile.minRam && item.ramGB >= profile.minRam) score += 6;
    }
    score += (s.budget - cheapest) / s.budget * 10;

    const ratio = cheapest / fullBudget;
    scored.push({ item: toProduct(item), local: item.local, dubai: landed, cheapest, score, brandMatch,
                  band: ratio <= 0.5 ? 'Budget-friendly' : ratio <= 0.8 ? 'Balanced' : 'Premium' });
  }
  scored.sort((a, b) => b.score - a.score);

  const perBrand = {}, picks = [];
  for(const r of scored){
    perBrand[r.item.brand] = (perBrand[r.item.brand] || 0) + 1;
    if(perBrand[r.item.brand] <= 2) picks.push(r);
    if(picks.length === 6) break;
  }
  const top = picks.slice(0, 3);                                       // "best value" = most score per shilling
  if(top.length){
    let best = top[0];
    for(const r of top) if(r.score / r.cheapest > best.score / best.cheapest) best = r;
    best.bestValue = true;
  }
  picks.forEach((r, i) => {
    r.why = whyList(r, s, profile);
    const other = i === 0 ? picks[1] : picks[0];
    r.compare = other ? compareText(r, other, i === 0) : '';
  });
  return picks;
}

/* plain-language reasons shown under "Why it fits you" */
function whyList(r, s, profile){
  const p = r.item, why = [];
  const isCompute = COMPUTE.includes(p.category);
  if(isCompute && s.workload) why.push('Handles ' + s.workload + ' work with the ' + p.cpu + '.');
  if(p.ramGB){
    const use = p.ramGB >= 32 ? 'large projects and many apps at once' : p.ramGB >= 16 ? 'multitasking and demanding software' : 'everyday apps and browsing';
    why.push(p.ramGB + ' GB' + (p.ramType ? ' ' + p.ramType : '') + ' memory is enough for ' + use + '.');
  }
  if(profile && profile.wantGpu && p.dgpu) why.push('Dedicated graphics (' + p.gpu + ') speeds up CAD, simulation, rendering and gaming.');
  if(p.batteryWh && (p.category === 'laptop' || p.category === 'tablet')) why.push(p.batteryWh + ' Wh battery. A bigger number means longer between charges.');
  if(r.brandMatch) why.push('It is from ' + p.brand + ', a brand you asked for.');
  if(isCompute && s.os !== 'any' && p.os === s.os) why.push('Runs ' + p.os + ', as you asked.');
  else if(isCompute && profile && profile.osLikes.includes(p.os)) why.push(p.os + ' is a common choice for this kind of work.');
  for(const t of s.ergo) if(p.tags.includes(t)) why.push('Matches your wish for ' + TAG_LABELS[t] + '.');
  const diff = p.local - p.landed.total;
  if(Math.abs(diff) > 500){
    const pct = Math.abs(diff) / p.local * 100;
    why.push(diff > 0 ? 'Importing from Dubai is about ' + kes(diff) + ' (' + pct.toFixed(0) + '%) cheaper than buying locally, after freight and VAT.'
                      : 'Buying locally is about ' + kes(-diff) + ' (' + pct.toFixed(0) + '%) cheaper than importing.');
  }
  return why.slice(0, 7);
}
function compareText(a, b, aIsTop){
  const x = a.item, y = b.item, bits = [];
  const dp = a.cheapest - b.cheapest;
  bits.push(Math.abs(dp) < 1000 ? 'about the same price' : kes(Math.abs(dp)) + (dp < 0 ? ' cheaper' : ' more expensive'));
  if(x.ramGB && y.ramGB && x.ramGB !== y.ramGB) bits.push((x.ramGB > y.ramGB ? 'more' : 'less') + ' memory (' + x.ramGB + ' GB vs ' + y.ramGB + ' GB)');
  if(x.batteryWh && y.batteryWh && Math.abs(x.batteryWh - y.batteryWh) >= 5) bits.push((x.batteryWh > y.batteryWh ? 'a bigger' : 'a smaller') + ' battery (' + x.batteryWh + ' Wh vs ' + y.batteryWh + ' Wh)');
  if(x.dgpu !== y.dgpu) bits.push(x.dgpu ? 'a dedicated graphics card' : 'no dedicated graphics card');
  return (aIsTop ? 'Against the runner-up, ' : 'Against the top match, ') + y.name + ': ' + bits.join(', ') + '.';
}

/* ----- bundles: the main device plus matching accessories, priced as one package ----- */
const COMPANIONS = {
  student:  { laptop:['mouse','audio','storage'], tablet:['keyboard','audio','storage'] },
  business: { desktop:['monitor','keyboard','mouse'], laptop:['monitor','mouse','keyboard'] },
  consumer: { laptop:['mouse','audio'], tablet:['keyboard','audio'], phone:['audio'], desktop:['monitor','keyboard','mouse'] }
};
const COMPANION_PREFS = {
  mouse:{ ergo:['ergonomic'] }, keyboard:{ ergo:['ergonomic'] }, audio:{ ergo:['noise'] },
  storage:{ storage:512 }, monitor:{ ergo:['screen','ergonomic'] }
};
const BUNDLE_TITLES = { student:'Student study setup', business:'Office setup', consumer:'Home setup' };

function buildBundle(pick, s, cats, profile){
  let remaining = s.budget - pick.cheapest;
  const parts = [{ item: pick.item, price: pick.cheapest, route: routeOf(pick.item) }];
  cats.forEach((cat, idx) => {
    const cap = idx === cats.length - 1 ? remaining : remaining * 0.5;
    const pref = COMPANION_PREFS[cat] || {};
    const list = recommendPicks({ role:s.role, category:cat, workload:'', budget:cap, os:'any',
                                  storage:pref.storage || 0, ergo:pref.ergo || [], brands:[] });
    if(list.length){
      parts.push({ item: list[0].item, price: list[0].cheapest, route: routeOf(list[0].item), why: list[0].why[0] || '' });
      remaining -= list[0].cheapest;
    }
  });
  const total = parts.reduce((t, p) => t + p.price, 0);
  return { title: BUNDLE_TITLES[s.role] || 'Bundle', parts, total, budget: s.budget, leftover: s.budget - total,
           units: s.role === 'business' ? (s.units || 1) : 1, software: profile ? profile.software : [] };
}

/* the sample version of POST /api/recommendations:  { picks, bundle } (bundle is for the top pick;
   every pick also carries its own `bundle`, an optional extension described in docs/API.md) */
function recommend(s){
  const cats = (s.bundle !== false && COMPANIONS[s.role] && COMPANIONS[s.role][s.category]) || [];
  const picks = recommendPicks(Object.assign({}, s, { budget: cats.length ? s.budget * 0.75 : s.budget, fullBudget: s.budget }));
  const profile = profileFor(s);
  if(cats.length) picks.forEach(p => { p.bundle = buildBundle(p, s, cats, profile); });
  return { picks, bundle: picks[0] && picks[0].bundle ? picks[0].bundle : null };
}

/* ----- audit log (admin changes are recorded here) ----- */
function logAudit(action){
  const session = load('itr_session', null);
  const log = load('itr_audit', []);
  log.unshift({ time: new Date().toLocaleString('en-KE'), who: session ? session.email : 'unknown', action });
  save('itr_audit', log.slice(0, 100));
}
