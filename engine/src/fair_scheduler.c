#include "scheduler.h"
#include <stdlib.h>
#include <stdio.h>

void fair_scheduler_init(fair_scheduler_t *fs) {
    if (!fs) return;
    pthread_mutex_init(&fs->lock, NULL);
    fs->active_readers = 0;
    fs->active_writers = 0;
    fs->head = NULL;
    fs->tail = NULL;
    fs->next_ticket = 1;
}

void fair_scheduler_destroy(fair_scheduler_t *fs) {
    if (!fs) return;
    pthread_mutex_lock(&fs->lock);
    fair_waiter_t *curr = fs->head;
    while (curr) {
        fair_waiter_t *next = curr->next;
        pthread_cond_destroy(&curr->cond);
        free(curr);
        curr = next;
    }
    fs->head = NULL;
    fs->tail = NULL;
    pthread_mutex_unlock(&fs->lock);
    pthread_mutex_destroy(&fs->lock);
}

// Helper: Evaluates queue and admits next eligible operations
// Precondition: fs->lock is held
static void fair_schedule_next(fair_scheduler_t *fs) {
    if (!fs->head) return;

    if (fs->active_writers > 0) {
        // Exclusive writer currently executing, cannot admit anyone
        return;
    }

    if (fs->head->is_writer) {
        // Next in FIFO order is a writer
        if (fs->active_readers == 0 && fs->active_writers == 0) {
            // Can grant exclusive access to head writer
            fair_waiter_t *w = fs->head;
            fs->head = w->next;
            if (!fs->head) fs->tail = NULL;

            fs->active_writers = 1;
            w->granted = true;
            pthread_cond_signal(&w->cond);
        }
        // If active_readers > 0, writer must wait for active readers to finish.
        // Crucially, newer readers will queue behind this writer!
    } else {
        // Next in FIFO order is a reader.
        // If no writer is active, admit head reader and all adjacent consecutive readers!
        if (fs->active_writers == 0) {
            while (fs->head && !fs->head->is_writer) {
                fair_waiter_t *r = fs->head;
                fs->head = r->next;
                if (!fs->head) fs->tail = NULL;

                fs->active_readers++;
                r->granted = true;
                pthread_cond_signal(&r->cond);
            }
        }
    }
}

static void remove_waiter(fair_scheduler_t *fs, fair_waiter_t *target) {
    fair_waiter_t *prev = NULL;
    fair_waiter_t *curr = fs->head;
    while (curr) {
        if (curr == target) {
            if (prev) {
                prev->next = curr->next;
            } else {
                fs->head = curr->next;
            }
            if (fs->tail == curr) {
                fs->tail = prev;
            }
            break;
        }
        prev = curr;
        curr = curr->next;
    }
}

int fair_reader_lock(fair_scheduler_t *fs, bool *stopped) {
    if (!fs) return -1;

    pthread_mutex_lock(&fs->lock);

    // If queue is empty and no active writer, admit immediately
    if (fs->head == NULL && fs->active_writers == 0) {
        fs->active_readers++;
        pthread_mutex_unlock(&fs->lock);
        return 0;
    }

    // Otherwise, enqueue in FIFO order
    fair_waiter_t *w = malloc(sizeof(fair_waiter_t));
    if (!w) {
        pthread_mutex_unlock(&fs->lock);
        return -1;
    }
    w->ticket = fs->next_ticket++;
    w->is_writer = false;
    w->granted = false;
    w->next = NULL;
    pthread_cond_init(&w->cond, NULL);

    if (fs->tail) {
        fs->tail->next = w;
        fs->tail = w;
    } else {
        fs->head = w;
        fs->tail = w;
    }

    while (!w->granted && (!stopped || !(*stopped))) {
        pthread_cond_wait(&w->cond, &fs->lock);
    }

    if (stopped && *stopped && !w->granted) {
        remove_waiter(fs, w);
        pthread_cond_destroy(&w->cond);
        free(w);
        fair_schedule_next(fs);
        pthread_mutex_unlock(&fs->lock);
        return -2; // Cancelled
    }

    // Granted!
    pthread_cond_destroy(&w->cond);
    free(w);
    pthread_mutex_unlock(&fs->lock);
    return 0;
}

int fair_reader_unlock(fair_scheduler_t *fs) {
    if (!fs) return -1;

    pthread_mutex_lock(&fs->lock);
    if (fs->active_readers > 0) {
        fs->active_readers--;
    }
    fair_schedule_next(fs);
    pthread_mutex_unlock(&fs->lock);
    return 0;
}

int fair_writer_lock(fair_scheduler_t *fs, bool *stopped) {
    if (!fs) return -1;

    pthread_mutex_lock(&fs->lock);

    // If queue is empty and resource is completely free, admit immediately
    if (fs->head == NULL && fs->active_readers == 0 && fs->active_writers == 0) {
        fs->active_writers = 1;
        pthread_mutex_unlock(&fs->lock);
        return 0;
    }

    // Enqueue writer in FIFO arrival order
    fair_waiter_t *w = malloc(sizeof(fair_waiter_t));
    if (!w) {
        pthread_mutex_unlock(&fs->lock);
        return -1;
    }
    w->ticket = fs->next_ticket++;
    w->is_writer = true;
    w->granted = false;
    w->next = NULL;
    pthread_cond_init(&w->cond, NULL);

    if (fs->tail) {
        fs->tail->next = w;
        fs->tail = w;
    } else {
        fs->head = w;
        fs->tail = w;
    }

    while (!w->granted && (!stopped || !(*stopped))) {
        pthread_cond_wait(&w->cond, &fs->lock);
    }

    if (stopped && *stopped && !w->granted) {
        remove_waiter(fs, w);
        pthread_cond_destroy(&w->cond);
        free(w);
        fair_schedule_next(fs);
        pthread_mutex_unlock(&fs->lock);
        return -2; // Cancelled
    }

    pthread_cond_destroy(&w->cond);
    free(w);
    pthread_mutex_unlock(&fs->lock);
    return 0;
}

int fair_writer_unlock(fair_scheduler_t *fs) {
    if (!fs) return -1;

    pthread_mutex_lock(&fs->lock);
    if (fs->active_writers > 0) {
        fs->active_writers = 0;
    }
    fair_schedule_next(fs);
    pthread_mutex_unlock(&fs->lock);
    return 0;
}
