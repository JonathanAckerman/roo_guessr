# Staged question captures

These are captured question images that are waiting for their answer point to
be marked on the master map. Run `pnpm dev`, open **Edit answers**, choose a
capture, place its pin, and save. The local authoring page creates the final
`src/locations/<id>/` directory, moves the capture to `question.webp`, and
writes `answer.txt`.
