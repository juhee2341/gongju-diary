/**
 * 사진 처리. JPEG 재인코딩으로 EXIF(위치 정보 포함)를 제거한다(기술 검증 4번).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AVATAR_SIZE, PHOTO_SIZE } from '@/constants/policy';

export type PickedImage = { uri: string; width: number; height: number };

/** [A4] 정사각 중앙 크롭 → AVATAR_SIZE로 축소 → JPEG 재인코딩 */
export async function processAvatar(img: PickedImage): Promise<string> {
  const side = Math.min(img.width, img.height);
  const ctx = ImageManipulator.manipulate(img.uri)
    .crop({
      originX: Math.floor((img.width - side) / 2),
      originY: Math.floor((img.height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_SIZE.jpegQuality });
  return out.uri;
}

/** 로컬 파일 URI → 업로드용 ArrayBuffer */
export async function readAsArrayBuffer(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  return res.arrayBuffer();
}
