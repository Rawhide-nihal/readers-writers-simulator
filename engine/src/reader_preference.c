#include "scheduler.h"
#include <stdio.h>

void reader_pref_init(reader_pref_t *rp) {
    if (!rp) return;
    pthread_mutex_init(&rp->readcount_lock, NULL);
    pthread_mutex_init(&rp->resource_lock, NULL);
    rp->read_count = 0;
}

void reader_pref_destroy(reader_pref_t *rp) {
    if (!rp) return;
    pthread_mutex_destroy(&rp->readcount_lock);
    pthread_mutex_destroy(&rp->resource_lock);
}

int reader_pref_reader_lock(reader_pref_t *rp) {
    if (!rp) return -1;

    // Mutex to protect read_count
    pthread_mutex_lock(&rp->readcount_lock);
    rp->read_count++;
    if (rp->read_count == 1) {
        // First reader must lock the shared resource gate
        pthread_mutex_lock(&rp->resource_lock);
    }
    pthread_mutex_unlock(&rp->readcount_lock);
    return 0;
}

int reader_pref_reader_unlock(reader_pref_t *rp) {
    if (!rp) return -1;

    pthread_mutex_lock(&rp->readcount_lock);
    rp->read_count--;
    if (rp->read_count == 0) {
        // Last reader releases the shared resource gate
        pthread_mutex_unlock(&rp->resource_lock);
    }
    pthread_mutex_unlock(&rp->readcount_lock);
    return 0;
}

int reader_pref_writer_lock(reader_pref_t *rp) {
    if (!rp) return -1;
    // Writer requests exclusive access to the shared resource
    pthread_mutex_lock(&rp->resource_lock);
    return 0;
}

int reader_pref_writer_unlock(reader_pref_t *rp) {
    if (!rp) return -1;
    pthread_mutex_unlock(&rp->resource_lock);
    return 0;
}
