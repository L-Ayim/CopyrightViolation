// src/graphql/mutations.ts
import { gql } from "@apollo/client";

export const DOWNLOAD_AUDIO = gql`
  mutation DownloadAudio($url: String!) {
    downloadAudio(url: $url) {
      success
      message
      downloadUrl
    }
  }
`;

export const UPLOAD_AUDIO = gql`
  mutation UploadAudio($file: Upload!, $title: String) {
    uploadAudio(file: $file, title: $title) {
      success
      message
      downloadUrl
    }
  }
`;

export const DELETE_DOWNLOAD = gql`
  mutation DeleteDownload($filename: String!) {
    deleteDownload(filename: $filename)
  }
`;
