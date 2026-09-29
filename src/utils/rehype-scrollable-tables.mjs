// Keep Markdown tables semantic, with their own keyboard-accessible scroll
// region so wide research results never widen the article on small screens.
export default function rehypeScrollableTables() {
  return (tree) => {
    const wrap = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'element' && child.tagName === 'table') {
          return {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['table-scroll'],
              tabIndex: 0,
              role: 'region',
              ariaLabel: 'Scrollable data table',
            },
            children: [child],
          };
        }
        wrap(child);
        return child;
      });
    };
    wrap(tree);
  };
}
