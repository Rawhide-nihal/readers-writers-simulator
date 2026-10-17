#include "scheduler.h"

void writer_pref_init(writer_pref_t *wp) {
    if (!wp) return;
    pthread_mutex_init(&wp->lock, NULL);
    pthread_cond_init(&wp->can_read, NULL);
    pthread_cond_init(&wp->can_write, NULL);
    wp->active_readers = 0;
    wp->active_writers = 0;
    wp->waiting_readers = 0;
    wp->waiting_writers = 0;
}

void writer_pref_destroy(writer_pref_t *wp) {
    if (!wp) return;
    pthread_mutex_destroy(&wp->lock);
    pthread_cond_destroy(&wp->can_read);
    pthread_cond_destroy(&wp->can_write);
}

int writer_pref_reader_lock(writer_pref_t *wp, bool *stopped) {
    if (!wp) return -1;

    pthread_mutex_lock(&wp->lock);
    wp->waiting_readers++;

    // In Writer Preference: Readers must wait if any writer is active OR waiting!
    while ((wp->active_writers > 0 || wp->waiting_writers > 0) && (!stopped || !(*stopped))) {
        pthread_cond_wait(&wp->can_read, &wp->lock);
    }

    if (stopped && *stopped) {
        wp->waiting_readers--;
        pthread_mutex_unlock(&wp->lock);
        return -2; // Cancelled
    }

    wp->waiting_readers--;
    wp->active_readers++;
    pthread_mutex_unlock(&wp->lock);
    return 0;
}

int writer_pref_reader_unlock(writer_pref_t *wp) {
    if (!wp) return -1;

    pthread_mutex_lock(&wp->lock);
    wp->active_readers--;

    // If no more readers are active and writers are waiting, wake one writer
    if (wp->active_readers == 0 && wp->waiting_writers > 0) {
        pthread_cond_signal(&wp->can_write);
    }
    pthread_mutex_unlock(&wp->lock);
    return 0;
}

int writer_pref_writer_lock(writer_pref_t *wp, bool *stopped) {
    if (!wp) return -1;

    pthread_mutex_lock(&wp->lock);
    wp->waiting_writers++;

    // Writers must wait until there are NO active writers AND NO active readers
    while ((wp->active_writers > 0 || wp->active_readers > 0) && (!stopped || !(*stopped))) {
        pthread_cond_wait(&wp->can_write, &wp->lock);
    }

    if (stopped && *stopped) {
        wp->waiting_writers--;
        pthread_mutex_unlock(&wp->lock);
        return -2; // Cancelled
    }

    wp->waiting_writers--;
    wp->active_writers++;
    pthread_mutex_unlock(&wp->lock);
    return 0;
}

int writer_pref_writer_unlock(writer_pref_t *wp) {
    if (!wp) return -1;

    pthread_mutex_lock(&wp->lock);
    wp->active_writers--;

    // Prioritize waiting writers over waiting readers!
    if (wp->waiting_writers > 0) {
        pthread_cond_signal(&wp->can_write);
    } else {
        // Only if no writers are waiting do we wake all waiting readers
        pthread_cond_broadcast(&wp->can_read);
    }

    pthread_mutex_unlock(&wp->lock);
    return 0;
}
