import { useCallback } from "react";
import { useApolloClient, useMutation } from "@apollo/client";
import { DOWNLOAD_AUDIO } from "../graphql/mutations";
import { GET_DOWNLOADS } from "../graphql/queries";

export function useDownloadAudio() {
  const client = useApolloClient();
  const [downloadAudio, { loading, error }] = useMutation(DOWNLOAD_AUDIO, {
    onCompleted: () => {
      // once the backend has finished downloading & separation,
      // refetch the downloads list so the new item appears
      client.refetchQueries({ include: [GET_DOWNLOADS] });
    },
  });

  const trigger = useCallback(
    (url: string) => {
      if (!loading) {
        downloadAudio({ variables: { url } });
      }
    },
    [downloadAudio, loading]
  );

  return { trigger, loading, error };
}
