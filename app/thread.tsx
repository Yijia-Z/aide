export interface Comment {
    id: string;
    author: string;
    text: string;
    timestamp: string;
    replies: Comment[];
}

export interface Post extends Comment { }

const initialThread: Post = {
    id: "123",
    author: "User",
    text: "Initial Post",
    timestamp: new Date().toISOString(),
    replies: [],
};

export default initialThread;