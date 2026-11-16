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
 * `expo-video`'s `VideoSource` accepts (see ../types/assets.d.ts).
 *
 * Pass `transparent` to render it with no frame, shadow or clipping of its own.
 *
 * Deliberately non-interactive: `pointerEvents="none"` leaves the parent
 * ScrollView's gestures intact.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView, type VideoContentFit } from 'expo-video';

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
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    // Muted so the tile autoplays without audio, which is also what both
    // platforms' autoplay policies require.
    instance.muted = true;
    // Nothing here reacts to time updates, so don't pay for the status events.
    instance.timeUpdateEventInterval = 0;
  });

  // expo-video never autoplays on its own — playback only starts on play().
  useEffect(() => {
    player.play();
  }, [player]);

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
      <VideoView
        player={player}
        nativeControls={false}
        contentFit={contentFit}
        // A SurfaceView lives in its own Android layer and clips/z-orders badly
        // inside a horizontal ScrollView; a TextureView composites correctly.
        surfaceType="textureView"
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
