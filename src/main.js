import './styles.css';
import { initTheme, initToc, initLightbox } from './shell.js';
import { initBudget, initFlight, initCG } from './widgets/design.js';
import { initPipeline, initAstar, initIbvs, initKamikaze, initPpm } from './widgets/autonomy.js';
import { initComms, initYki, initBench, initChecklist } from './widgets/ops.js';

const safe = (name, fn) => {
  try {
    fn();
  } catch (err) {
    console.error(`[${name}]`, err);
  }
};

initTheme();
safe('toc', initToc);
const lightbox = initLightbox();
safe('budget', initBudget);
safe('flight', initFlight);
safe('cg', initCG);
safe('pipeline', initPipeline);
safe('astar', initAstar);
safe('ibvs', initIbvs);
safe('kamikaze', initKamikaze);
safe('ppm', initPpm);
safe('comms', initComms);
safe('yki', initYki);
safe('bench', () => initBench(lightbox));
safe('checklist', initChecklist);
