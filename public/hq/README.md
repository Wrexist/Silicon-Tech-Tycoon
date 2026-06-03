# Custom HQ artwork (optional)

Want to use your own garage/office art instead of the built-in vector scene?

1. Drop an image here, e.g. `garage.png` (or `.svg`). Recommended ~**4:3** aspect
   (the scene area renders at 340×300), transparent background, looks good on both
   light and dark UI.
2. Open `src/components/IsoScene.tsx` and set the constant near the top:
   ```ts
   const HQ_CUSTOM_ASSET: string | null = "/hq/garage.png";
   ```
3. Save — it replaces the vector garage with your image.

Leave `HQ_CUSTOM_ASSET = null` to keep the built-in animated vector scene.

(Hero devices are always parametric vector — this asset hook is only for the HQ backdrop.)
