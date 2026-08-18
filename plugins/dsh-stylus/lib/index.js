// dsh-stylus — host half.
// The feature lives entirely in the browser (the client bundle); this host
// entry only needs to be a resolvable, applyable plugin so the loader can
// mount the row and the client-modules scan can pick up the dsh.client
// declaration.
export const name = "dsh-stylus";
export const inject = [];
export function apply(ctx) {
  // Nothing host-side to do.
}
