import styles from './style';
import { type ContainerProps } from './types';

// ** forwardref render functions do not support proptypes or defaultprops **
// one of the reasons why we use a separate prop for passing ref instead of using forwardref

function MonacoContainer({
  width,
  height,
  isEditorReady,
  _ref,
  className,
  wrapperProps,
}: ContainerProps) {
  return (
    <section style={{ ...styles.wrapper, width, height }} {...wrapperProps}>
      {!isEditorReady && 'Loading....'}
      <div
        ref={_ref}
        style={{ ...styles.fullWidth, ...(!isEditorReady && styles.hide) }}
        className={className}
      />
    </section>
  );
}

export default MonacoContainer;