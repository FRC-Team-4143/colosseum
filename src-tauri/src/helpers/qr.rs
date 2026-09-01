//! QR transport framing — encode side only. Rendering stays a frontend concern;
//! QR *import* (camera scanning + reassembly) was removed.

pub const MAX_CHUNK_PAYLOAD: usize = 200;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QrError {
    TooManyChunks(usize),
}

impl std::fmt::Display for QrError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TooManyChunks(total) => {
                write!(formatter, "QR stream has {total} chunks; maximum is 9999")
            }
        }
    }
}

impl std::error::Error for QrError {}

/// Encodes UTF-8 data into the `IIIITTTT<base64>` QR wire format.
pub fn encode_frames(payload: &str) -> Result<Vec<String>, QrError> {
    let encoded = encode_base64(payload.as_bytes());
    let chunks: Vec<&str> = if encoded.is_empty() {
        vec![""]
    } else {
        encoded
            .as_bytes()
            .chunks(MAX_CHUNK_PAYLOAD)
            .map(|chunk| std::str::from_utf8(chunk).expect("base64 is ASCII"))
            .collect()
    };
    if chunks.len() > 9_999 {
        return Err(QrError::TooManyChunks(chunks.len()));
    }
    let total = chunks.len();
    Ok(chunks
        .iter()
        .enumerate()
        .map(|(index, chunk)| format!("{index:04}{total:04}{chunk}"))
        .collect())
}

const BASE64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_base64(input: &[u8]) -> String {
    let mut output = String::with_capacity(input.len().div_ceil(3) * 4);
    for group in input.chunks(3) {
        let first = group[0];
        let second = *group.get(1).unwrap_or(&0);
        let third = *group.get(2).unwrap_or(&0);
        output.push(BASE64[(first >> 2) as usize] as char);
        output.push(BASE64[(((first & 0b11) << 4) | (second >> 4)) as usize] as char);
        output.push(if group.len() > 1 {
            BASE64[(((second & 0b1111) << 2) | (third >> 6)) as usize] as char
        } else {
            '='
        });
        output.push(if group.len() > 2 {
            BASE64[(third & 0b11_1111) as usize] as char
        } else {
            '='
        });
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_payload_is_a_single_headered_frame() {
        assert_eq!(encode_frames("").unwrap(), vec!["00000001"]);
    }

    #[test]
    fn a_long_unicode_payload_splits_into_headered_base64_chunks() {
        let frames = encode_frames(&"x".repeat(400)).unwrap();
        assert_eq!(frames.len(), 3);
        assert_eq!(&frames[0][..8], "00000003");
        assert!(frames.iter().all(|f| f.len() <= 8 + MAX_CHUNK_PAYLOAD));
    }
}
