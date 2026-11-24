// The usage count of a view that is opened (docs/USAGE.md): one call per view; `community` has no name and counts nothing.

import { viewName } from '../core/usage/events';
import type { View } from './views';
import { count } from './usage';

export const countView = (view: View) => count(viewName(view));
