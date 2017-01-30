export default (props) => {
  const classes = [props.className, 'btn group-btn btn-xs job-group-count filter-shown'];
  return (
    <button
      className={classes.join(' ')}
      title={props.title}
      onClick={props.onClick}
      key={props.countKey}
    >{props.count}</button>
  );
};

