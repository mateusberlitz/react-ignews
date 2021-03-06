import { GetStaticProps } from 'next';
import Head from 'next/head';
import { getPrismicClient } from '../../services/prismic';
import styles from './styles.module.scss';
import Prismic from '@prismicio/client';
import { RichText } from 'prismic-dom';
import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/client';

interface Post{
    slug: string;
    title: string;
    except: string;
    updatedAt: string;
}

interface PostsProps{
    posts: Post[];
}

export default function Posts({posts}: PostsProps){
    const [session] = useSession();

    return(
        <>
            <Head>
                <title>Posts | Ignews</title>
            </Head>

            <main className={styles.container}>
                <div className={styles.postList}>
                    {
                        posts.map(post => (
                            <Link key={post.slug} href={`${session?.activeSubscription ? '/posts/' : '/posts/preview/'}${post.slug}`}>
                                <a>
                                    <time>{post.updatedAt}</time>
                                    <strong>{post.title}</strong>
                                    <p>{post.except}</p>
                                </a>
                            </Link>
                        ))
                    }
                </div>
            </main>
        </>
    );
}

export const getStaticProps: GetStaticProps = async () => {
    const prismic = getPrismicClient();

    const response = await prismic.query([
        Prismic.predicates.at('document.type', 'post')
    ], {
       fetch: ['post.title', 'post.content'],
       pageSize: 100,
    });

    const posts = response.results.map(post => {
        return {
            slug: post.uid,
            title: RichText.asText(post.data.title),
            except: post.data.content.find(content => content.type === 'paragraph')?.text ?? '',
            updatedAt: new Date(post.last_publication_date).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            })
            //updatedAt: new Date(post.last_publication_date)
        }
    });

    return {
        props: {
            posts
        }
    }
}