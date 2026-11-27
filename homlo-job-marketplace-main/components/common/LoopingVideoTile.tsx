/**
 * components/common/LoopingVideoTile.tsx
 *
 * A silent, endlessly looping video sized like a logo tile. Used on the
 * category detail page (CategoryListingScreen.tsx), where it floats over the
 * hero at the right edge of the "Top employers hiring" area rather than sitting
 * inside that row's ScrollView.
 *
 * `source` is the bundled-asset handle for a local video — the numeric value a
 * static `import` of e.g. `@/assets/images/foo.mov` resolves to, which is what
 * `react-native-video`'s `source` accepts (see ../types/assets.d.ts).
 *
 * Pass `transparent` to render it with no frame, shadow or clipping of its own.
 *
 * Deliberately non-interactive: `pointerEvents="none"` leaves the parent
 * ScrollView's gestures intact.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Video from 'react-native-video';

type VideoContentFit = 'cover' | 'contain' | 'fill';

type Props = {
  /** Bundled-asset handle for a local video file. */
  source: number;
  size?: number;
  borderRadius?: number;
  /**
   * 'cover' (default) fills the tile and crops, matching how a logo tile
   * behaves. 'contain' shows the whole frame but letterboxes inside the tile.
   */
  contentFit?: VideoContentFit;
  style?: StyleProp<ViewStyle>;
  /**
   * Drops the rounded frame, its shadow and the clipping so the video sits
   * directly on the hero gradient with nothing drawn behind it. Pair with a
   * source that carries an alpha channel so the transparent pixels actually
   * let the background through.
   */
  transparent?: boolean;
};

export default function LoopingVideoTile({
  source,
  size = 56,
  borderRadius = 16,
  contentFit = 'cover',
  style,
  transparent = false,
}: Props) {
  return (
    // The wrapper carries the rounding and the shadow so the native video
    // surface underneath can stay unclipped, matching the employer logo tile.
    // With `transparent` the wrapper adds nothing at all, so the video reads as
    // a free-floating layer over whatever sits behind it.
    <View
      style={[
        transparent ? styles.bare : styles.frame,
        { width: size, height: size, borderRadius },
        style,
      ]}
    >
      <Video
        // A static require() of a bundled video is a numeric asset id.
        source={source as never}
        // Muted so the tile autoplays without audio, which is also what both
        // platforms' autoplay policies require.
        muted
        repeat
        paused={false}
        controls={false}
        resizeMode={contentFit === 'fill' ? 'stretch' : contentFit}
        // A SurfaceView lives in its own Android layer and clips/z-orders badly
        // inside a horizontal ScrollView; a TextureView composites correctly.
        viewType={0}
        // Never take audio focus from music the user is playing.
        disableFocus
        ignoreSilentSwitch="obey"
        mixWithOthers="mix"
        playInBackground={false}
        pointerEvents="none"
        style={styles.video}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  bare: {},
  video: { flex: 1 },
});
